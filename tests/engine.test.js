// Extension engine test with a fake browser and a fake network (no key, no internet). It exists because the
// engine is the only way drafts are made, and its retry, backup-model, fix-warnings and learning logic can
// break without any build test noticing.
// Usage: node tests/engine.test.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { ruleFiles } = require(path.join(ROOT, 'scripts', 'build-extension.js'));

// ---- fake chrome: in-memory storage, rule files served from the repo
const mem = {};
global.chrome = {
  storage: { local: {
    get: async k => (k === null ? Object.assign({}, mem) : { [k]: mem[k] }),
    set: async o => { Object.assign(mem, JSON.parse(JSON.stringify(o))); },
    remove: async k => { delete mem[k]; }
  } },
  runtime: { getURL: p => 'ext://' + p }
};
const RULES = ruleFiles();
function ruleResponse(name) {
  const text = name === 'index.json' ? JSON.stringify({ files: Object.keys(RULES.map), examples: RULES.examples }) : fs.readFileSync(path.join(ROOT, 'rules', RULES.map[name]), 'utf8');
  return { ok: true, status: 200, text: async () => text };
}

// ---- fake Gemini answers
const reply = body => ({ ok: true, status: 200, text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: typeof body === 'string' ? body : JSON.stringify(body) }] }, finishReason: 'STOP' }], modelVersion: 'fake' }) });
const fail = (status, msg) => ({ ok: false, status, text: async () => JSON.stringify({ error: { message: msg } }) });
function fakeFetch(answers, calls) {
  let i = 0;
  global.fetch = async url => {
    if (url.startsWith('ext://rules/')) return ruleResponse(url.slice('ext://rules/'.length));
    calls.push(url.split('/').pop().split(':')[0]);
    return answers[i++] || fail(500, 'no more fake answers');
  };
}

const engine = require(path.join(ROOT, 'extension', 'core', 'engine.js'));
const learn = require(path.join(ROOT, 'extension', 'core', 'learn.js'));
const store = require(path.join(ROOT, 'extension', 'core', 'store.js'));
const BASE = JSON.parse(fs.readFileSync(path.join(ROOT, 'rules', 'sample-draft.json'), 'utf8'));
const draft = titleEnd => { const d = JSON.parse(JSON.stringify(BASE)); d.posts.find(p => p.dir === 'ltr').title += titleEnd || ''; return d; };

async function createWith(answers, opts) {
  const calls = [];
  fakeFetch(answers, calls);
  const o = Object.assign({ apiKey: 'fake', models: ['m1', 'm2'], retries: 1, backoffMs: [1], humanizer: false }, opts);
  try { return { calls, res: await engine.createDraft('Blood donation campaign', o) }; } catch (e) { return { calls, err: e }; }
}

let failed = 0;
async function check(name, fn) {
  try { await fn(); console.log('PASS ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

(async function () {
  await check('bad JSON and check warnings are sent back until the draft is clean', async () => {
    const r = await createWith([reply(draft('.')), reply('not json'), reply(draft())]);
    need(r.res && r.res.repairs === 2 && !r.res.warnings.length, JSON.stringify(r.res || r.err.message));
    need(await store.getDraft(r.res.id), 'draft was not saved');
  });
  await check('warnings it cannot fix are returned and saved, not hidden', async () => {
    const r = await createWith([reply(draft('.')), reply(draft('.'))], { repairs: 1 });
    need(r.res && r.res.warnings.length === 1 && /full stop/.test(r.res.warnings[0]), JSON.stringify(r.res || r.err.message));
  });
  await check('two drafts with the same title get different ids', async () => {
    const ids = (await store.listDrafts()).map(d => d.id);
    need(new Set(ids).size === ids.length && ids.length === 2, ids.join(','));
  });
  await check('a busy server is retried, a missing model falls back to the backup model', async () => {
    const r = await createWith([fail(503, 'busy'), fail(404, 'no model'), reply(draft())]);
    need(r.res && r.calls.join(',') === 'm1,m1,m2', 'calls: ' + r.calls.join(',') + ' ' + (r.err ? r.err.message : ''));
  });
  await check('a bad API key stops at once (no retries)', async () => {
    const r = await createWith([fail(400, 'API key not valid')]);
    need(r.err && r.err.code === 'bad_key' && r.calls.length === 1, r.err ? r.err.code + ' after ' + r.calls.length + ' call(s)' : 'no error');
  });
  await check('learning keeps a backup of the old rules before changing them', async () => {
    for (const d of await store.listDrafts()) {
      const e = JSON.parse(JSON.stringify(d.data));
      e.posts.forEach(p => { p.title += ' edited'; });
      e.owner_approved_at = { rtl: '2026-11-09T10:00:00Z', ltr: '2026-11-09T10:00:00Z' };
      await store.saveEdits(d.id, e, []);
    }
    fakeFetch([reply({ section: "## Learned from the owner's edits\n- test rule", summary: 'ok' })], []);
    const r = await learn.learnFromEdits({ apiKey: 'fake', humanizer: false });
    need(r.changed, 'rules not changed: ' + r.summary);
    need(/test rule/.test(await store.getLearned()), 'learned section not saved');
    need((await store.getBackups()).length === 1, 'no backup of the old section');
  });
  await check('rules export and import round-trip; a wrong file is refused', async () => {
    const out = await learn.exportRules();
    need(/test rule/.test(out.learnedSection), 'export lost the rule');
    need(!(await learn.importRules('{"learnedSection":"nope"}')).ok, 'bad file accepted');
    need((await learn.importRules(JSON.stringify(out))).ok, 'good file refused');
  });
  process.exit(failed ? 1 : 0);
})();
