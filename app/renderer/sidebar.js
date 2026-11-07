// Sidebar: the drafts history list, like past chats in a chat app.
let drafts = [], fresh = new Set();

function renderDrafts() {
  const box = $('drafts'); box.textContent = '';
  if (!drafts.length) { box.appendChild(el('p', 'empty', t('noDrafts'))); return; }
  drafts.forEach(d => box.appendChild(draftRow(d)));
}

function draftRow(d) {
  const row = el('div', 'draft');
  const info = el('div', 'info');
  const title = el('div', 't', (lang === 'ar' && d.titleAr) ? d.titleAr : d.title);
  if (fresh.has(d.name)) title.appendChild(el('span', 'badge new', t('fresh')));
  if (d.hasEdited) title.appendChild(el('span', 'badge edited', t('edited')));
  const sub = el('div', 's', [d.created, d.name].filter(Boolean).join('  ·  '));
  sub.dir = 'ltr';
  info.appendChild(title); info.appendChild(sub);
  const btn = el('button', null, t('open'));
  btn.disabled = running;
  btn.addEventListener('click', () => window.api.openDraft(d.name));
  row.appendChild(info); row.appendChild(btn);
  return row;
}

async function refresh() { drafts = await window.api.listDrafts(); renderDrafts(); }
