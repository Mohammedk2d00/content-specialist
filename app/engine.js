// Direct-API engine: one writing request per post (instead of an agent making many round trips).
// Keeps every rule from GEMINI.md, the style guide, the examples, the humanizer skills, the build check,
// the warning-fix loop and learning from edits. Pure Node (no Electron) so it can be tested alone.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DEFAULTS = {
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/',
  models: ['gemini-3.5-flash', 'gemini-flash-latest'],
  thinking: 'low',        // less hidden thinking = faster; the build check + repair loop protect quality
  timeoutSec: 90,         // per attempt (a spike of ~30 s was seen on a one-word request)
  retries: 2,             // retries per model, so 3 attempts per model before the fallback model
  backoffMs: [1500, 4000, 8000],
  repairs: 3,             // how many times to send build warnings back to the model
  humanizer: true,
  maxOutputTokens: 24000
};

class ApiError extends Error {
  constructor(code, message, extra) { super(message); this.code = code; Object.assign(this, extra || {}); }
}

// Turn an HTTP failure into a short code the window can explain in English and Arabic.
function classify(status, bodyText) {
  let j = null; try { j = JSON.parse(bodyText); } catch (e) {}
  const err = (j && j.error) || {};
  let msg = String(err.message || bodyText || '');
  // the CLI wraps errors as JSON inside a string; unwrap once
  try { const inner = JSON.parse(msg); if (inner && inner.error) { msg = String(inner.error.message || msg); err.details = inner.error.details || err.details; } } catch (e) {}
  const details = Array.isArray(err.details) ? err.details : [];
  const info = details.find(d => d && d.reason) || {};
  const url = (info.metadata && info.metadata.activationUrl) || '';
  if (info.reason === 'SERVICE_DISABLED' || /has not been used in project|is disabled/i.test(msg)) return new ApiError('api_disabled', msg, { status, url });
  if (/free tier is not available|set up billing/i.test(msg)) return new ApiError('free_tier', msg, { status });
  if (/API key not valid|API_KEY_INVALID|API key expired/i.test(msg) || info.reason === 'API_KEY_INVALID') return new ApiError('bad_key', msg, { status });
  if (status === 429) return new ApiError('rate', msg, { status });
  if (status === 404) return new ApiError('model_missing', msg, { status });
  if (status === 400 && /thinking/i.test(msg)) return new ApiError('bad_thinking', msg, { status });
  if (status === 401 || status === 403) return new ApiError('denied', msg, { status, url });
  if (status >= 500) return new ApiError('busy', msg, { status });
  return new ApiError('other', msg, { status });
}
const RETRYABLE = new Set(['busy', 'rate', 'timeout', 'network', 'empty']);
const FATAL = new Set(['api_disabled', 'free_tier', 'bad_key', 'denied']);

async function callOnce(o, model, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), o.timeoutSec * 1000);
  const onAbort = () => ctrl.abort(new Error('cancelled'));
  if (o.signal) { if (o.signal.aborted) throw new ApiError('cancelled', 'cancelled'); o.signal.addEventListener('abort', onAbort); }
  try {
    let res;
    try {
      res = await fetch(o.baseUrl + model + ':generateContent', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': o.apiKey },
        body: JSON.stringify(body)
      });
    } catch (e) {
      if (o.signal && o.signal.aborted) throw new ApiError('cancelled', 'cancelled');
      if (ctrl.signal.aborted) throw new ApiError('timeout', 'No answer after ' + o.timeoutSec + ' seconds');
      throw new ApiError('network', String(e && e.message || e));
    }
    const text = await res.text();
    if (!res.ok) throw classify(res.status, text);
    let j; try { j = JSON.parse(text); } catch (e) { throw new ApiError('empty', 'The answer was not valid JSON'); }
    const cand = (j.candidates || [])[0];
    const parts = (cand && cand.content && cand.content.parts) || [];
    const out = parts.filter(p => typeof p.text === 'string' && !p.thought).map(p => p.text).join('');
    if (!out) throw new ApiError('empty', 'The model returned no text' + (cand && cand.finishReason ? ' (' + cand.finishReason + ')' : ''));
    if (cand.finishReason === 'MAX_TOKENS') throw new ApiError('empty', 'The answer was cut off (too long)');
    return { text: out, modelVersion: j.modelVersion || model, usage: j.usageMetadata || {} };
  } finally { clearTimeout(timer); if (o.signal) o.signal.removeEventListener('abort', onAbort); }
}

const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  if (signal) signal.addEventListener('abort', () => { clearTimeout(t); rej(new ApiError('cancelled', 'cancelled')); }, { once: true });
});

// Retry with waits, then fall back to the next model. Fatal errors (key, billing, API off) stop at once.
async function generate(opts, system, contents) {
  const o = Object.assign({}, DEFAULTS, opts);
  const log = o.log || (() => {});
  const gen = { responseMimeType: 'application/json', maxOutputTokens: o.maxOutputTokens };
  if (o.thinking) gen.thinkingConfig = { thinkingLevel: o.thinking };
  let last = null;
  for (const model of o.models) {
    for (let attempt = 0; attempt <= o.retries; attempt++) {
      const body = { systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: Object.assign({}, gen) };
      try {
        log('Asking ' + model + (attempt ? ' (try ' + (attempt + 1) + ')' : '') + '...\n');
        const t0 = Date.now();
        const r = await callOnce(o, model, body);
        log('Answer received in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's (' + r.modelVersion + (r.usage.promptTokenCount ? ', ' + r.usage.promptTokenCount + ' prompt tokens' : '') + (r.usage.thoughtsTokenCount ? ', ' + r.usage.thoughtsTokenCount + ' thinking' : '') + ').\n');
        return r;
      } catch (e) {
        last = e;
        if (e.code === 'cancelled' || FATAL.has(e.code)) throw e;
        if (e.code === 'bad_thinking' && gen.thinkingConfig) { delete gen.thinkingConfig; log('This model does not accept the thinking setting; continuing without it.\n'); attempt--; continue; }
        if (e.code === 'model_missing') { log(model + ' is not available for this key; trying the next model.\n'); break; }
        if (!RETRYABLE.has(e.code)) throw e;
        log('Problem (' + e.code + '): ' + String(e.message).slice(0, 140) + '\n');
        if (attempt < o.retries) { const w = o.backoffMs[Math.min(attempt, o.backoffMs.length - 1)]; log('Waiting ' + (w / 1000) + 's, then trying again.\n'); await sleep(w, o.signal); }
        else log('Giving up on ' + model + '.\n');
      }
    }
  }
  throw last || new ApiError('other', 'No model answered');
}

const rd = (ws, f) => { try { return fs.readFileSync(path.join(ws, f), 'utf8'); } catch (e) { return ''; } };

function listBlock(ws) {
  let d; try { d = JSON.parse(rd(ws, 'dashboard-lists.json')); } catch (e) { return ''; }
  const s = (d.structures || []).map(x => (x.en || '(none in the dashboard)') + ' | ' + (x.ar || '')).join('\n');
  const names = l => ((d.categories || {})[l] || []).map(c => c.name).filter(n => n && !/\[CHECK/.test(n)).join('\n');
  return '## Dashboard lists (copy names EXACTLY as written; this replaces running lookup.js)\n### Structures (English | Arabic)\n' + s +
    '\n### Category Dep names, English posts\n' + names('en') + '\n### Category Dep names, Arabic posts\n' + names('ar') + '\n';
}

function systemPrompt(ws, o) {
  const ex = (() => { try { return fs.readdirSync(path.join(ws, 'examples')).filter(f => f.endsWith('.md')).sort().map(f => '### examples/' + f + '\n' + rd(ws, 'examples/' + f)).join('\n'); } catch (e) { return ''; } })();
  let p = 'You are the Content Specialist engine of the UOWA project, running in API mode. You have NO tools: you cannot read files, run commands or ask questions. Everything you need is below.\n' +
    'Reply with ONE JSON object only (the draft data file described in GEMINI.md under "JSON format"). No text before or after it, no code fences.\n' +
    'Where the project files say to read files, run lookup.js, run the build command, fix warnings, ask a question, or give a short reply, ignore that: the app does it. If no college or unit can be worked out, use the closest Structure and list it under "Choices to confirm" in review and review_ar.\n' +
    'Use today\'s date from the user message for "created". Never output a slug or any key that is not in the JSON format.\n\n' +
    '# GEMINI.md\n' + rd(ws, 'GEMINI.md') + '\n\n# style-guide.md\n' + rd(ws, 'style-guide.md') + '\n\n# examples\n' + ex + '\n\n# sample-draft.json (copy this shape)\n' + rd(ws, 'sample-draft.json') +
    '\n\n# latin-allowlist.txt\n' + rd(ws, 'latin-allowlist.txt') + '\n\n' + listBlock(ws);
  if (o.humanizer) {
    const ar = rd(ws, '.gemini/skills/humanizer-ar-msa/SKILL.md'), en = rd(ws, '.gemini/skills/humanizer/SKILL.md');
    if (ar) p += '\n# Writing skill for the ARABIC post (apply silently while writing; do not mention it)\n' + ar + '\n';
    if (en) p += '\n# Writing skill for the ENGLISH post (apply silently while writing; do not mention it)\n' + en + '\n';
  }
  return p;
}

function parseJson(text) {
  let t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a > 0 || (b >= 0 && b < t.length - 1)) t = t.slice(a, b + 1);
  const j = JSON.parse(t);
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('not an object');
  return j;
}

function slugify(s) { return String(s || 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'post'; }
const today = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };

// Run a project script with the app's own Node (works with plain node too).
function runScript(ws, args) {
  return new Promise(resolve => {
    const c = spawn(process.execPath, args, { cwd: ws, windowsHide: true, env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1', NO_OPEN: '1' }) });
    let out = '', err = '';
    c.stdout.setEncoding('utf8'); c.stderr.setEncoding('utf8');
    c.stdout.on('data', d => out += d); c.stderr.on('data', d => err += d);
    c.on('error', e => resolve({ code: -1, out, err: String(e.message) }));
    c.on('close', code => resolve({ code, out, err }));
  });
}

async function createDraft(ws, requestText, opts) {
  const o = Object.assign({}, DEFAULTS, opts);
  const log = o.log || (() => {});
  const system = systemPrompt(ws, o);
  const date = today();
  const contents = [{ role: 'user', parts: [{ text: 'Today is ' + date + '.\nThe owner\'s request:\n\n' + String(requestText).trim() + '\n\nReturn the draft JSON now.' }] }];
  log('Writing the draft (one request)...\n');
  let r = await generate(o, system, contents);
  let data = null, lastText = r.text, problems = '';
  for (let round = 0; round <= o.repairs; round++) {
    try { data = parseJson(lastText); problems = ''; } catch (e) { data = null; problems = 'Your answer was not valid JSON (' + e.message + '). Return the complete JSON object only.'; }
    let name = null;
    if (data) {
      if (!data.created) data.created = date;
      name = date + '_' + slugify(data.request_title);
      let n = 2, base = name; while (fs.existsSync(path.join(ws, 'drafts', name + '.json'))) name = base + '-' + (n++);
      fs.mkdirSync(path.join(ws, 'drafts'), { recursive: true });
      fs.writeFileSync(path.join(ws, 'drafts', name + '.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');
      const b = await runScript(ws, ['build.js', 'drafts/' + name + '.json']);
      problems = (b.code !== 0 || /WARNING/.test(b.err)) ? (b.err || b.out).trim() : '';
      if (!problems) { log('Build check passed with no warnings.\n'); return { name, html: path.join(ws, 'drafts', name + '.html'), warnings: [], repairs: round }; }
      log('Build check found problems' + (round < o.repairs ? '; asking the model to fix them (' + (round + 1) + '/' + o.repairs + ')' : '') + ':\n' + problems + '\n');
      if (round === o.repairs || b.code !== 0 && !fs.existsSync(path.join(ws, 'drafts', name + '.html'))) {
        if (round === o.repairs) return { name, html: path.join(ws, 'drafts', name + '.html'), warnings: problems.split('\n').filter(l => /^\s*-/.test(l)).map(l => l.replace(/^\s*-\s*/, '')), repairs: round };
      }
      try { fs.unlinkSync(path.join(ws, 'drafts', name + '.json')); fs.unlinkSync(path.join(ws, 'drafts', name + '.html')); } catch (e) {} // keep only the final version
    } else if (round === o.repairs) throw new ApiError('bad_output', problems);
    contents.push({ role: 'model', parts: [{ text: lastText }] });
    contents.push({ role: 'user', parts: [{ text: 'The build check reported these problems. Fix every one and return the complete corrected JSON object only:\n\n' + problems }] });
    r = await generate(o, system, contents); lastText = r.text;
  }
  throw new ApiError('bad_output', problems);
}

// Learn from the owner's edits: run learn.js, then ask the model to rewrite only the learned section of style-guide.md.
async function learnFromEdits(ws, opts) {
  const o = Object.assign({}, DEFAULTS, opts);
  const log = o.log || (() => {});
  const rr = await runScript(ws, ['learn.js']);
  log((rr.out + rr.err).trim() + '\n');
  const report = rd(ws, 'feedback/report.md');
  if (!report || /No edited drafts found|no approved posts/i.test(rr.out)) return { changed: false, summary: 'No edited drafts to learn from yet.' };
  const guide = rd(ws, 'style-guide.md');
  const H = "## Learned from the owner's edits";
  const idx = guide.indexOf(H);
  const system = 'You maintain the section "' + H + '" at the end of style-guide.md. Follow GEMINI.md, section "Learning from the owner\'s edits", steps 2 to 4, exactly. You have no tools. Reply with ONE JSON object: {"section": "<the COMPLETE new text of that section, starting with the line ' + H + '>", "summary": "<brief reply for the owner: drafts read, each rule added or changed, anything the owner must decide>"}. If there are no repeated corrections, return the current section unchanged and say so in the summary.\n\n# GEMINI.md\n' + rd(ws, 'GEMINI.md') + '\n\n# style-guide.md (current)\n' + guide;
  const r = await generate(o, system, [{ role: 'user', parts: [{ text: 'feedback/report.md:\n\n' + report + '\n\nThe owner says: learn from my edits.' }] }]);
  const j = parseJson(r.text);
  const section = String(j.section || '').trim();
  if (!section.startsWith(H)) throw new ApiError('bad_output', 'The model returned a section without the expected heading.');
  fs.copyFileSync(path.join(ws, 'style-guide.md'), path.join(ws, 'style-guide.md.bak'));
  const next = (idx >= 0 ? guide.slice(0, idx) : guide.replace(/\s*$/, '\n\n')) + section + '\n';
  fs.writeFileSync(path.join(ws, 'style-guide.md'), next, 'utf8');
  return { changed: next !== guide, summary: String(j.summary || 'Done.') };
}

// One tiny request, used by the "Test key" button: reports status, seconds and the model really served.
async function testKey(opts) {
  const o = Object.assign({}, DEFAULTS, opts, { retries: 0 });
  const model = o.models[0];
  const t0 = Date.now();
  try {
    const r = await callOnce(o, model, { contents: [{ parts: [{ text: 'Hello' }] }] });
    return { ok: true, ms: Date.now() - t0, model: r.modelVersion };
  } catch (e) { return { ok: false, ms: Date.now() - t0, code: e.code || 'other', url: e.url || '', message: String(e.message).slice(0, 300), model }; }
}

module.exports = { DEFAULTS, ApiError, classify, generate, callOnce, createDraft, learnFromEdits, testKey, systemPrompt, parseJson, slugify };
