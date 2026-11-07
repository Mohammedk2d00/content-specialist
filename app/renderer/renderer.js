// Entry point: language switch, composer, run state, and wiring of main-process events.
// Loaded last; uses helpers from i18n.js, thread.js, sidebar.js and settings.js.
let running = false;

function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(e => { e.placeholder = t(e.dataset.i18nPh); });
  $('lang').textContent = lang === 'ar' ? 'English' : 'العربية';
  renderDrafts(); renderStatus(); renderKeyState();
}

function setState(msg) { $('state').textContent = msg || ''; }

// While a run is going, Send becomes Stop and run-starting buttons are disabled.
function setRunning(on) {
  running = on;
  ['importEdits', 'learn', 'btnNode', 'btnGemini', 'keyTest', 'newPost'].forEach(id => { $(id).disabled = on; });
  $('create').hidden = on;
  $('cancel').hidden = !on;
  document.querySelectorAll('.draft button').forEach(b => { b.disabled = on; });
}

// A run that could not start (busy, no key) gets an error reply; returns false so the caller can undo.
async function startAndHandle(p) {
  const r = await p;
  if (!r || r.ok !== false) return true;
  const msg = r.error === 'busy' ? t('busy') : r.error === 'nokey' ? t('err_nokey') : r.error === 'empty' ? t('empty') : t('err_other');
  failReply(msg);
  return false;
}

function sendRequest() {
  if (running) return;
  const v = $('req').value.trim();
  if (!v) { setState(t('empty')); return; }
  setState(''); setLink('');
  addUserMessage(v);
  $('req').value = '';
  startAndHandle(window.api.createPost(v)).then(ok => { if (!ok && !$('req').value) $('req').value = v; });
}

$('lang').addEventListener('click', () => { lang = lang === 'en' ? 'ar' : 'en'; localStorage.setItem('lang', lang); applyLang(); });
$('create').addEventListener('click', sendRequest);
$('cancel').addEventListener('click', () => window.api.cancel());
$('newPost').addEventListener('click', clearThread);
// Enter sends, Shift+Enter adds a line; isComposing keeps Arabic/IME input safe.
$('req').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendRequest(); }
});

window.api.onStart(() => { setRunning(true); setState(''); ensureReply(); });
window.api.onLog(appendReplyLog);
window.api.onDone(async d => {
  setRunning(false);
  if (d.code !== 0 && !d.cancelled) setLink(d.url);
  d.created.forEach(n => fresh.add(n));
  await refresh();
  finishReply(d);
  if (d.kind === 'install') refreshStatus();
});

applyLang();
refresh();
refreshStatus();
