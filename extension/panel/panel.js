// Side panel entry point: language switch, the "write a draft" flow and live refresh of the drafts list.
// Bundled by build-extension.js into dist/panel.js.
const store = require('../core/store.js');
const { createDraft } = require('../core/engine.js');
const { t, errText, setLang, getLang, applyLang } = require('./panel-i18n.js');
const { renderDrafts, openReview, markFresh } = require('./panel-drafts.js');
const { wireSettings, renderKeyState } = require('./panel-settings.js');

const $ = id => document.getElementById(id);
let run = null; // AbortController of the draft being written

function progress(text, kind) {
  const p = $('progress');
  p.hidden = !text; p.textContent = text || ''; p.className = 'progress ' + (kind || '');
}
function logLine(s) { const d = $('log'); d.hidden = false; const pre = d.querySelector('pre'); pre.textContent += s; pre.scrollTop = pre.scrollHeight; }

function setRunning(on) {
  $('create').hidden = on; $('cancel').hidden = !on;
  $('req').disabled = on; $('facts').disabled = on;
}

// The facts box is optional; when filled it goes to the writer as owner-given facts.
function requestText() {
  const title = $('req').value.trim(), facts = $('facts').value.trim();
  return facts ? title + '\n\nFacts from the owner:\n' + facts : title;
}

async function writeDraft() {
  if (run) return;
  if (!$('req').value.trim()) { progress(t('empty'), 'bad'); return; }
  const apiKey = await store.getKey();
  if (!apiKey) { progress(t('err_nokey'), 'bad'); return; }
  run = new AbortController();
  setRunning(true);
  $('log').querySelector('pre').textContent = ''; $('log').hidden = true; $('log').open = false;
  const step = (name, info) => progress(t(name, info), 'working');
  try {
    const r = await createDraft(requestText(), { apiKey, signal: run.signal, log: logLine, step });
    markFresh(r.id);
    progress(r.warnings.length ? t('doneWarn', { n: r.warnings.length }) : t('done'), 'ok');
    $('req').value = ''; $('facts').value = '';
    openReview(r.id);
  } catch (e) {
    if (e.code === 'cancelled') progress(t('cancelled'), 'muted');
    else { progress(errText(e.code), 'bad'); logLine(String(e.message || e) + '\n'); }
  } finally {
    run = null; setRunning(false); renderDrafts();
  }
}

async function switchLang() {
  setLang(getLang() === 'ar' ? 'en' : 'ar');
  await store.setUi(getLang());
  applyLang(); renderDrafts(); renderKeyState();
}

$('create').addEventListener('click', writeDraft);
$('cancel').addEventListener('click', () => { if (run) run.abort(); });
$('lang').addEventListener('click', switchLang);
// Ctrl+Enter writes from either box; plain Enter keeps adding lines (Arabic input stays safe).
['req', 'facts'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing) { e.preventDefault(); writeDraft(); } }));
wireSettings(() => renderKeyState());

// The review tab saves edits and approvals to storage; show them here at once.
let queued = null;
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !Object.keys(changes).some(k => k.startsWith('d:'))) return;
  clearTimeout(queued); queued = setTimeout(renderDrafts, 300);
});

(async function init() {
  setLang(await store.getUi());
  applyLang();
  await renderKeyState();
  renderDrafts();
})();
