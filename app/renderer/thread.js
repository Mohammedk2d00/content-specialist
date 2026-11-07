// Chat thread: shows each request as a user bubble and each run as an assistant reply,
// so the window reads like a conversation instead of one raw log.
// Bubbles live only for this session; drafts on disk stay the record.
let reply = null; // { el, status, log, details } for the run in progress

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function scrollThread() { const th = $('thread'); th.scrollTop = th.scrollHeight; }

function addUserMessage(text) {
  const m = el('div', 'msg user');
  m.appendChild(el('div', 'bubble', text));
  $('thread').appendChild(m);
  scrollThread();
}

// One reply per run; logs that arrive before run:start (learn sends one) open it early.
function ensureReply() {
  if (reply) return reply;
  const m = el('div', 'msg bot');
  const b = el('div', 'bubble');
  const status = el('div', 'status working', t('working'));
  const details = el('details', 'log');
  details.appendChild(el('summary', null, t('details')));
  const log = el('pre');
  details.appendChild(log);
  details.hidden = true;
  b.appendChild(status); b.appendChild(details); m.appendChild(b);
  $('thread').appendChild(m);
  reply = { el: b, status, log, details };
  scrollThread();
  return reply;
}

function appendReplyLog(s) {
  const r = ensureReply();
  r.details.hidden = false;
  r.log.textContent += s;
  r.log.scrollTop = r.log.scrollHeight;
}

// Turn the run result into a final status line plus a card per new draft.
function finishReply(d) {
  const r = ensureReply();
  r.status.classList.remove('working');
  let msg, kind = 'ok';
  if (d.cancelled) { msg = t('cancelled'); kind = 'muted'; }
  else if (d.code === 0) {
    msg = d.warnings ? t('warnDone', { n: d.warnings }) : d.created.length ? t('created') + d.created.join(', ') : t('done');
    if (d.warnings) kind = 'warn';
  } else { msg = d.errorCode ? errText(d.errorCode) : t('failed'); kind = 'bad'; }
  r.status.textContent = msg;
  r.status.classList.add(kind);
  if (kind === 'bad') r.details.open = true;
  d.created.forEach(name => r.el.appendChild(draftCard(name)));
  if (kind === 'bad' && d.url) { // e.g. "enable the API" page for this key's Google project
    const b = el('button', null, t('openLink'));
    b.addEventListener('click', () => window.api.openUrl(d.url));
    r.el.appendChild(b);
  }
  reply = null;
  scrollThread();
}

// Standalone reply not tied to a run (start errors, update offers); a run in progress keeps its own bubble.
function botNote(msg, kind) {
  const keep = reply; reply = null;
  const r = ensureReply();
  r.status.className = 'status ' + (kind || '');
  r.status.textContent = msg;
  reply = keep;
  return r.el;
}
function failReply(msg) { botNote(msg, 'bad'); }

function draftCard(name) {
  const c = el('div', 'card');
  const d = drafts.find(x => x.name === name);
  c.appendChild(el('div', 'ct', d ? ((lang === 'ar' && d.titleAr) || d.title) : name));
  const sub = el('div', 'cs', name); sub.dir = 'ltr'; c.appendChild(sub);
  const row = el('div', 'row');
  const open = el('button', 'primary', t('openBrowser'));
  open.addEventListener('click', () => window.api.openDraft(name));
  const folder = el('button', null, t('folder'));
  folder.addEventListener('click', () => window.api.openFolder());
  row.appendChild(open); row.appendChild(folder); c.appendChild(row);
  return c;
}

// "New post": clear the conversation (not the drafts) and focus the composer.
function clearThread() {
  if (running) return;
  document.querySelectorAll('#thread .msg').forEach(m => m.remove());
  reply = null;
  $('req').focus();
}
