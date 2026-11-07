// Gemini API client: one HTTP call, error classification, retries with waits and the fallback model.
// Pure Node (no Electron) so it can be tested alone.

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
  const o = withDefaults(opts);
  const log = o.log;
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

// Fill in the defaults; log is always a function.
function withDefaults(opts, extra) { const o = Object.assign({}, DEFAULTS, opts, extra); if (!o.log) o.log = () => {}; return o; }

// One tiny request, used by the "Test key" button: reports status, seconds and the model really served.
async function testKey(opts) {
  const o = withDefaults(opts, { retries: 0 });
  const model = o.models[0];
  const t0 = Date.now();
  try {
    const r = await callOnce(o, model, { contents: [{ parts: [{ text: 'Hello' }] }] });
    return { ok: true, ms: Date.now() - t0, model: r.modelVersion };
  } catch (e) { return { ok: false, ms: Date.now() - t0, code: e.code || 'other', url: e.url || '', message: String(e.message).slice(0, 300), model }; }
}

module.exports = { DEFAULTS, ApiError, classify, callOnce, generate, testKey, withDefaults };
