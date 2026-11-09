// Review tab: loads a draft from browser storage into the same page script build.js uses
// (templates/draft-page.js), and saves every edit and approval back to storage for the side panel.
const store = require('../core/store.js');

const id = new URLSearchParams(location.search).get('id') || '';

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

function showMissing() {
  document.getElementById('app').textContent = 'This draft is no longer in this browser. / هذه المسودة لم تعد موجودة في هذا المتصفح.';
}

(async function () {
  const d = await store.getDraft(id);
  if (!d) { showMissing(); return; }
  window.UOWA_DRAFT = Object.assign({}, d.data, { draft_id: d.id });
  window.UOWA_onChange = debounce((edited, payloads) => store.saveEdits(d.id, edited, payloads), 400);
  const s = document.createElement('script');
  s.src = '../dist/draft-page.js';
  document.body.appendChild(s);
})();
