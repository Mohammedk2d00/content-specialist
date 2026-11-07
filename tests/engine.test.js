// Fast-engine test with a fake network (no key, no internet). It exists because the Fast engine is the default
// way drafts are made, and its retry, backup-model and fix-warnings logic can break without any build test noticing.
// Usage: node tests/engine.test.js <workspace copy>   (selftest.js runs it on its temporary folder)
const fs = require('fs');
const path = require('path');

const ENGINE = path.join(__dirname, '..', 'app', 'main', 'engine.js');
if (!fs.existsSync(ENGINE)) { console.log('SKIP Fast engine not in this folder (app/main/engine.js)'); process.exit(0); }
const engine = require(ENGINE);
const WS = path.resolve(process.argv[2] || '.');
const BASE = JSON.parse(fs.readFileSync(path.join(WS, 'sample-draft.json'), 'utf8'));
const draft = function (titleEnd) { const d = JSON.parse(JSON.stringify(BASE)); d.posts.find(function (p) { return p.dir === 'ltr'; }).title += titleEnd || ''; return d; };

// fake Gemini answers
const reply = function (body) { return { ok: true, status: 200, text: async function () { return JSON.stringify({ candidates: [{ content: { parts: [{ text: typeof body === 'string' ? body : JSON.stringify(body) }] }, finishReason: 'STOP' }], modelVersion: 'fake' }); } }; };
const fail = function (status, msg) { return { ok: false, status: status, text: async function () { return JSON.stringify({ error: { message: msg } }); } }; };
function fakeFetch(answers, calls) {
  let i = 0;
  global.fetch = async function (url) { calls.push(url.split('/').pop().split(':')[0]); return answers[i++] || fail(500, 'no more fake answers'); };
}
async function createWith(answers, opts) {
  const calls = [];
  fakeFetch(answers, calls);
  const o = Object.assign({ apiKey: 'fake', models: ['m1', 'm2'], retries: 1, backoffMs: [1], humanizer: false }, opts);
  try { return { calls: calls, res: await engine.createDraft(WS, 'Blood donation campaign', o) }; } catch (e) { return { calls: calls, err: e }; }
}

let failed = 0;
async function check(name, fn) {
  try { await fn(); console.log('PASS ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

(async function () {
  await check('bad JSON and build warnings are sent back until the draft is clean', async function () {
    const r = await createWith([reply(draft('.')), reply('not json'), reply(draft())]);
    need(r.res && r.res.repairs === 2 && !r.res.warnings.length, JSON.stringify(r.res || r.err.message));
    need(fs.existsSync(r.res.html), 'draft page was not written');
  });
  await check('warnings it cannot fix are returned, not hidden', async function () {
    const r = await createWith([reply(draft('.')), reply(draft('.'))], { repairs: 1 });
    need(r.res && r.res.warnings.length === 1 && /full stop/.test(r.res.warnings[0]), JSON.stringify(r.res || r.err.message));
  });
  await check('a busy server is retried, a missing model falls back to the backup model', async function () {
    const r = await createWith([fail(503, 'busy'), fail(404, 'no model'), reply(draft())]);
    need(r.res && r.calls.join(',') === 'm1,m1,m2', 'calls: ' + r.calls.join(',') + ' ' + (r.err ? r.err.message : ''));
  });
  await check('a bad API key stops at once (no retries)', async function () {
    const r = await createWith([fail(400, 'API key not valid')]);
    need(r.err && r.err.code === 'bad_key' && r.calls.length === 1, r.err ? r.err.code + ' after ' + r.calls.length + ' call(s)' : 'no error');
  });
  await check('learning saves a dated backup of the style guide before changing it', async function () {
    if (!fs.existsSync(path.join(WS, 'style-guide.md'))) fs.copyFileSync(path.join(__dirname, '..', 'style-guide.md'), path.join(WS, 'style-guide.md'));
    const before = fs.readFileSync(path.join(WS, 'style-guide.md'), 'utf8');
    fakeFetch([reply({ section: "## Learned from the owner's edits\n- test rule", summary: 'ok' })], []);
    const r = await engine.learnFromEdits(WS, { apiKey: 'fake', humanizer: false });
    const backups = fs.readdirSync(path.join(WS, 'feedback')).filter(function (f) { return /^style-guide-.*\.md$/.test(f); });
    need(r.changed, 'style guide not changed: ' + r.summary);
    need(backups.length && fs.readFileSync(path.join(WS, 'feedback', backups[0]), 'utf8') === before, 'no dated backup with the old text');
  });
  process.exit(failed ? 1 : 0);
})();
