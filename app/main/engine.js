// Direct-API engine: one writing request per post (instead of an agent making many round trips).
// Keeps every rule from GEMINI.md, the style guide, the examples, the humanizer skills, the build check,
// the warning-fix loop and learning from edits. Pure Node (no Electron) so it can be tested alone.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { readText } = require('./lib.js');
const { DEFAULTS, ApiError, classify, callOnce, generate, testKey, withDefaults } = require('./gemini-api.js');
const { systemPrompt } = require('./prompt.js');

const draftFile = (ws, name, ext) => path.join(ws, 'drafts', name + ext);

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
  const o = withDefaults(opts);
  const log = o.log;
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
      let n = 2, base = name; while (fs.existsSync(draftFile(ws, name, '.json'))) name = base + '-' + (n++);
      fs.mkdirSync(path.join(ws, 'drafts'), { recursive: true });
      fs.writeFileSync(draftFile(ws, name, '.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');
      const b = await runScript(ws, ['build.js', 'drafts/' + name + '.json']);
      problems = (b.code !== 0 || /WARNING/.test(b.err)) ? (b.err || b.out).trim() : '';
      if (!problems) { log('Build check passed with no warnings.\n'); return { name, html: draftFile(ws, name, '.html'), warnings: [], repairs: round }; }
      log('Build check found problems' + (round < o.repairs ? '; asking the model to fix them (' + (round + 1) + '/' + o.repairs + ')' : '') + ':\n' + problems + '\n');
      if (round === o.repairs) return { name, html: draftFile(ws, name, '.html'), warnings: problems.split('\n').filter(l => /^\s*-/.test(l)).map(l => l.replace(/^\s*-\s*/, '')), repairs: round };
      try { fs.unlinkSync(draftFile(ws, name, '.json')); fs.unlinkSync(draftFile(ws, name, '.html')); } catch (e) {} // keep only the final version
    } else if (round === o.repairs) throw new ApiError('bad_output', problems);
    contents.push({ role: 'model', parts: [{ text: lastText }] });
    contents.push({ role: 'user', parts: [{ text: 'The build check reported these problems. Fix every one and return the complete corrected JSON object only:\n\n' + problems }] });
    r = await generate(o, system, contents); lastText = r.text;
  }
  throw new ApiError('bad_output', problems);
}

// Learn from the owner's edits: run learn.js, then ask the model to rewrite only the learned section of style-guide.md.
async function learnFromEdits(ws, opts) {
  const o = withDefaults(opts);
  const log = o.log;
  const rr = await runScript(ws, ['learn.js']);
  log((rr.out + rr.err).trim() + '\n');
  const report = readText(ws, 'feedback/report.md');
  if (!report || /No edited drafts found|no approved posts/i.test(rr.out)) return { changed: false, summary: 'No edited drafts to learn from yet.' };
  const guide = readText(ws, 'style-guide.md');
  const H = "## Learned from the owner's edits";
  const idx = guide.indexOf(H);
  const system = 'You maintain the section "' + H + '" at the end of style-guide.md. Follow GEMINI.md, section "Learning from the owner\'s edits", steps 2 to 4, exactly. You have no tools. Reply with ONE JSON object: {"section": "<the COMPLETE new text of that section, starting with the line ' + H + '>", "summary": "<brief reply for the owner: drafts read, each rule added or changed, anything the owner must decide>"}. If there are no repeated corrections, return the current section unchanged and say so in the summary.\n\n# GEMINI.md\n' + readText(ws, 'GEMINI.md') + '\n\n# style-guide.md (current)\n' + guide;
  const r = await generate(o, system, [{ role: 'user', parts: [{ text: 'feedback/report.md:\n\n' + report + '\n\nThe owner says: learn from my edits.' }] }]);
  const j = parseJson(r.text);
  const section = String(j.section || '').trim();
  if (!section.startsWith(H)) throw new ApiError('bad_output', 'The model returned a section without the expected heading.');
  fs.copyFileSync(path.join(ws, 'style-guide.md'), path.join(ws, 'style-guide.md.bak'));
  const next = (idx >= 0 ? guide.slice(0, idx) : guide.replace(/\s*$/, '\n\n')) + section + '\n';
  fs.writeFileSync(path.join(ws, 'style-guide.md'), next, 'utf8');
  return { changed: next !== guide, summary: String(j.summary || 'Done.') };
}

module.exports = { DEFAULTS, ApiError, classify, generate, callOnce, createDraft, learnFromEdits, testKey, systemPrompt, parseJson, slugify };
