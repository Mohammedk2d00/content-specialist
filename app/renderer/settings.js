// Settings dialog: tools, connection (engine + API key) and status chips,
// moved out of the sidebar so the main window stays a clean chat.
let status = null, lastUrl = '';

function setLink(url) { lastUrl = url || ''; $('openLink').hidden = !lastUrl; }

function renderKeyState(msg) {
  const k = $('keyState');
  if (msg) { k.textContent = msg; return; }
  if (!status) { k.textContent = ''; return; }
  k.textContent = status.key === 'saved' ? t('keySavedState') : status.key === 'env' ? t('keyEnvState') : t('keyNone');
}

function renderStatus() {
  const f = $('chips'); f.textContent = '';
  if (!status) return;
  const chip = (label, ok) => { const s = el('span', 'chip' + (ok === undefined ? '' : ok ? ' ok' : ' bad'), label); f.appendChild(s); return s; };
  const direct = status.engine === 'direct';
  chip(t('version') + ': ' + status.version);
  chip(t('engine') + ': ' + (direct ? t('fast') : t('classic')));
  chip(t('model') + ': ' + status.model);
  if (direct) chip(t('key') + ': ' + (status.key === 'saved' ? t('kSaved') : status.key === 'env' ? t('kEnv') : t('kNone')), status.key !== 'none');
  else { chip(t('node') + ': ' + (status.node || t('missing')), !!status.node); chip(t('gemini') + ': ' + (status.gemini || t('missing')), !!status.gemini); }
  chip(t('ws') + ': ' + status.workspace).dir = 'ltr';
  $('engine').value = status.engine;
  $('setup').hidden = direct || !!(status.node && status.gemini);
  $('btnNode').hidden = !!status.node;
  $('btnGemini').hidden = !!status.gemini || !status.node;
  $('terminal').hidden = direct; $('firstRun').hidden = direct;
}

async function refreshStatus() { status = await window.api.status(); renderStatus(); renderKeyState(); }

// Tool buttons that start a run show as a user message, then the reply bubble follows.
function startTool(label, call) {
  $('settings').close();
  addUserMessage(label);
  startAndHandle(call());
}

$('openSettings').addEventListener('click', () => $('settings').showModal());
$('closeSettings').addEventListener('click', () => $('settings').close());
$('learn').addEventListener('click', () => startTool(t('learnReq'), window.api.learn));
$('importEdits').addEventListener('click', async () => {
  const r = await window.api.importEdits();
  setState(t('importedN') + (r.moved.length ? r.moved.length : t('none')));
  refresh();
});
$('terminal').addEventListener('click', () => window.api.openTerminal());
$('folder').addEventListener('click', () => window.api.openFolder());
$('ext').addEventListener('click', () => window.api.openExtension());
$('btnNode').addEventListener('click', () => startTool(t('installReq') + ' ' + t('node'), window.api.installNode));
$('btnGemini').addEventListener('click', () => startTool(t('installReq') + ' ' + t('gemini'), window.api.installGemini));
$('openLink').addEventListener('click', () => { if (lastUrl) window.api.openUrl(lastUrl); });
$('engine').addEventListener('change', async () => { await window.api.setEngine($('engine').value); refreshStatus(); });

$('keySave').addEventListener('click', async () => {
  const r = await window.api.saveKey($('key').value);
  if (r.ok) { $('key').value = ''; setLink(''); await refreshStatus(); renderKeyState(t('keySavedOk')); } else renderKeyState(t('keyBad'));
});
$('keyClear').addEventListener('click', async () => { await window.api.clearKey(); setLink(''); await refreshStatus(); });
$('keyTest').addEventListener('click', async () => {
  renderKeyState(t('testing')); setLink('');
  const r = await window.api.testKey();
  if (r.ok) renderKeyState(t('testOk', { s: (r.ms / 1000).toFixed(1), m: r.model }));
  else { renderKeyState(errText(r.code)); setLink(r.url); }
});
