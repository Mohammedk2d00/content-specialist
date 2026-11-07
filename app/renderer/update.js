// Updates: a patch found in Downloads is offered as a chat message; Settings can install a picked patch file.
// Installing restarts the app, so the new files load.
const updErr = (code, v) => { const k = 'upd_' + code; return t(k) === k ? t('upd_failed') : t(k, { v: v || '' }); };

async function installUpdate(file, btn) {
  const r = await window.api.applyUpdate(file);
  if (r.ok) { botNote(t('updateDone', { v: r.to }), 'ok working'); return; }
  failReply(updErr(r.error, r.to));
  if (btn) btn.disabled = false;
}

function offerUpdate(info) {
  const b = botNote(t('updateFound', { v: info.to, c: info.current }));
  const btn = el('button', 'primary', t('updateInstall'));
  btn.addEventListener('click', () => { btn.disabled = true; installUpdate(info.file, btn); });
  b.appendChild(btn);
}

// Shows a checked patch ({ ok, file, to, current }) as an offer, or its problem as an error.
function showUpdate(i) {
  if (!i) return;
  if (i.ok && i.auto) installUpdate(i.file); // notification clicked: install now
  else if (i.ok) offerUpdate(i); else failReply(updErr(i.error, i.to));
}

$('updatePick').addEventListener('click', async () => {
  const i = await window.api.pickUpdate();
  if (i) $('settings').close();
  showUpdate(i);
});

window.api.onUpdateOffer(showUpdate); // patch double-clicked while the app is open
window.api.findUpdate().then(showUpdate); // patch double-clicked to start the app, or found in Downloads
