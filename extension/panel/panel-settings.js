// Settings dialog and the first-run card: the Gemini key, learning from edits, and sharing rules by file.
const store = require('../core/store.js');
const { testKey } = require('../core/engine.js');
const { learnFromEdits, exportRules, importRules } = require('../core/learn.js');
const { t, errText } = require('./panel-i18n.js');

const $ = id => document.getElementById(id);
let lastUrl = '';

function say(id, text, kind) { const e = $(id); e.textContent = text || ''; e.className = 'hint' + (kind ? ' ' + kind : ''); }
const looksLikeKey = k => k.length >= 20 && k.length <= 300 && !/\s/.test(k);

// Save, then test at once, so a wrong key shows up now and not on the first draft.
async function saveAndTest(inputId, stateId) {
  const k = $(inputId).value.trim();
  if (!looksLikeKey(k)) { say(stateId, t('keyBad'), 'bad'); return false; }
  await store.setKey(k);
  $(inputId).value = '';
  return checkKey(stateId);
}

async function checkKey(stateId) {
  say(stateId, t('testing'));
  const r = await testKey({ apiKey: await store.getKey(), timeoutSec: 60 });
  lastUrl = r.ok ? '' : (r.url || '');
  $('openLink').hidden = !lastUrl;
  say(stateId, r.ok ? t('testOk') : errText(r.code), r.ok ? 'ok' : 'bad');
  return r.ok;
}

async function renderKeyState() {
  const has = !!(await store.getKey());
  say('keyState', has ? t('keySavedState') : t('keyNone'));
  $('setup').hidden = has;
  return has;
}

async function learn() {
  $('learn').disabled = true; say('learnState', t('learning'));
  try {
    const r = await learnFromEdits({ apiKey: await store.getKey() });
    say('learnState', r.summary === 'none' ? t('learnNone') : (r.changed ? t('learnDone') : t('learnSame')) + (r.summary !== 'none' && r.summary ? '\n' + r.summary : ''), r.changed ? 'ok' : '');
  } catch (e) { say('learnState', errText(e.code), 'bad'); }
  $('learn').disabled = false;
}

async function saveRulesFile() {
  const blob = new Blob([JSON.stringify(await exportRules(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'uowa-rules-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function loadRulesFile(file) {
  const r = await importRules(await file.text());
  say('rulesState', r.ok ? t('importOk') : t('importBad'), r.ok ? 'ok' : 'bad');
}

function wireSettings(onKeyChange) {
  $('openSettings').addEventListener('click', () => { renderKeyState(); $('settings').showModal(); });
  $('closeSettings').addEventListener('click', () => $('settings').close());
  $('setupSave').addEventListener('click', async () => { await saveAndTest('setupKey', 'setupState'); onKeyChange(); });
  $('keySave').addEventListener('click', async () => { await saveAndTest('key', 'keyState'); onKeyChange(); });
  $('keyTest').addEventListener('click', () => checkKey('keyState'));
  $('keyClear').addEventListener('click', async () => { await store.clearKey(); await renderKeyState(); onKeyChange(); });
  $('openLink').addEventListener('click', () => { if (lastUrl) chrome.tabs.create({ url: lastUrl }); });
  $('learn').addEventListener('click', learn);
  $('rulesExport').addEventListener('click', saveRulesFile);
  $('rulesImport').addEventListener('click', () => $('rulesFile').click());
  $('rulesFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) loadRulesFile(f); e.target.value = ''; });
}

module.exports = { wireSettings, renderKeyState };
