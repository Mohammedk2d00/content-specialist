// Everything the extension keeps, in chrome.storage.local (this browser only; survives reloads and updates).
// Replaces the desktop app's drafts folder, key file and style-guide edits.
//   key           Gemini API key
//   ui            interface language ('ar' | 'en')
//   learned       the learned section of style-guide.md (null = use the bundled one)
//   backups       last 10 learned sections, newest first: [{at, section}]
//   d:<id>        one draft: {id, created, data, edited, payloads}
const area = chrome.storage.local;
const DRAFT = 'd:';
const MAX_BACKUPS = 10;

async function get(k) { return (await area.get(k))[k]; }
function set(k, v) { return area.set({ [k]: v }); }

const getKey = () => get('key');
const setKey = k => set('key', k);
const clearKey = () => area.remove('key');
const getUi = async () => (await get('ui')) || 'ar';
const setUi = v => set('ui', v);

async function listDrafts() {
  const all = await area.get(null);
  return Object.keys(all).filter(k => k.startsWith(DRAFT)).map(k => all[k]).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
}
const getDraft = id => get(DRAFT + id);
async function draftExists(id) { return !!(await getDraft(id)); }
function saveDraft(d) { return set(DRAFT + d.id, Object.assign({ savedAt: new Date().toISOString() }, d)); }
async function saveEdits(id, edited, payloads) {
  const d = await getDraft(id);
  if (!d) return;
  d.edited = edited; d.payloads = payloads;
  return set(DRAFT + id, d);
}
const deleteDraft = id => area.remove(DRAFT + id);

const getLearned = () => get('learned');
async function getBackups() { return (await get('backups')) || []; }
// Every change to the learned rules keeps the previous version, so a bad learn or import can be undone.
async function setLearned(section, previous) {
  if (previous) {
    const b = [{ at: new Date().toISOString(), section: previous }].concat(await getBackups()).slice(0, MAX_BACKUPS);
    await set('backups', b);
  }
  return set('learned', section);
}

module.exports = { getKey, setKey, clearKey, getUi, setUi, listDrafts, getDraft, draftExists, saveDraft, saveEdits, deleteDraft, getLearned, getBackups, setLearned };
