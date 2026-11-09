// Draft cards for the side panel: the result of the last run and the history list.
// Each card offers Review (opens the review tab) and, once a language is approved, Fill for that language.
const store = require('../core/store.js');
const { t, getLang } = require('./panel-i18n.js');
const { fillForm } = require('./panel-fill.js');

const fresh = new Set();

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function titleOf(d) { return (getLang() === 'ar' && d.data.request_title_ar) || d.data.request_title || d.id; }

// Approved posts with their dashboard payloads, as saved by the review page.
function approvedPosts(d) {
  const at = (d.edited && d.edited.owner_approved_at) || {};
  return (d.data.posts || []).map((p, i) => ({ dir: p.dir, payload: (d.payloads || [])[i] })).filter(x => at[x.dir] && x.payload);
}

function openReview(id) { chrome.tabs.create({ url: chrome.runtime.getURL('review/review.html?id=' + encodeURIComponent(id)) }); }

async function fill(post, msg) {
  msg.className = 'msg'; msg.textContent = t('filling');
  const r = await fillForm(post);
  if (r.ok) { msg.className = 'msg ' + (r.fails ? 'bad' : 'ok'); msg.textContent = r.fails ? t('fillFails', { n: r.fails }) : t('fillOk'); }
  else { msg.className = 'msg bad'; msg.textContent = t('fill_' + r.error) === 'fill_' + r.error ? t('fill_other') : t('fill_' + r.error); }
}

function draftCard(d, onChange) {
  const c = el('div', 'draft' + (fresh.has(d.id) ? ' isnew' : ''));
  const title = el('div', 't', titleOf(d));
  const ok = approvedPosts(d);
  if (ok.length) title.appendChild(el('span', 'badge ok', t('approved')));
  else if (d.edited) title.appendChild(el('span', 'badge', t('edited')));
  c.appendChild(title);
  c.appendChild(el('div', 's', d.created || ''));
  const row = el('div', 'row'), msg = el('div', 'msg');
  const review = el('button', 'primary', t('review'));
  review.addEventListener('click', () => openReview(d.id));
  row.appendChild(review);
  ok.forEach(x => {
    const b = el('button', null, x.dir === 'rtl' ? t('fillAr') : t('fillEn'));
    b.addEventListener('click', () => fill(x.payload, msg));
    row.appendChild(b);
  });
  const del = el('button', 'ghost', t('del'));
  del.addEventListener('click', async () => { if (confirm(t('confirmDel'))) { await store.deleteDraft(d.id); onChange(); } });
  row.appendChild(del);
  c.appendChild(row);
  if (!ok.length) msg.textContent = t('needApprove');
  c.appendChild(msg);
  return c;
}

async function renderDrafts() {
  const box = document.getElementById('drafts');
  const drafts = await store.listDrafts();
  box.textContent = '';
  if (!drafts.length) { box.appendChild(el('p', 'empty', t('noDrafts'))); return; }
  drafts.slice(0, 30).forEach(d => box.appendChild(draftCard(d, renderDrafts)));
}

module.exports = { renderDrafts, openReview, markFresh: id => fresh.add(id) };
