// Learn from the owner's edits: compare each approved draft with its edited copy (the shared learn/ modules),
// then ask the model to rewrite only the learned section of the style guide. Every change keeps a backup.
const { ApiError, generate, withDefaults } = require('./gemini-api.js');
const { parseJson } = require('./draft-json.js');
const { LEARNED_HEADING, loadRules, readRule, learnedSectionOf } = require('./rules.js');
const store = require('./store.js');

const MIN_DRAFTS = 2; // a correction must repeat in this many drafts to count (same default as learn.js)

// The repeated-corrections report, built from drafts in storage instead of files in a folder.
async function editsReport() {
  const comparePairs = require('../../shared/learn/compare.js').comparePairs;
  const P = require('../../shared/learn/patterns.js');
  const buildReport = require('../../shared/learn/report.js');
  const pairs = (await store.listDrafts()).filter(d => d.edited)
    .map(d => ({ id: d.id, orig: d.data, edit: d.edited, editFile: d.id + ' (edited)' }));
  if (!pairs.length) return null;
  const posts = comparePairs(pairs, false);
  if (!posts.length) return null;
  return buildReport(pairs, posts, P.findPatterns(posts, MIN_DRAFTS), MIN_DRAFTS, false).text;
}

// Returns {changed, summary}.
async function learnFromEdits(opts) {
  const o = withDefaults(opts);
  await loadRules();
  const report = await editsReport();
  if (!report) return { changed: false, summary: 'none' };
  const guide = readRule('style-guide.md');
  const system = 'You maintain the section "' + LEARNED_HEADING + '" at the end of style-guide.md. Follow GEMINI.md, section "Learning from the owner\'s edits", steps 2 to 4, exactly. You have no tools. Reply with ONE JSON object: {"section": "<the COMPLETE new text of that section, starting with the line ' + LEARNED_HEADING + '>", "summary": "<brief reply for the owner: drafts read, each rule added or changed, anything the owner must decide>"}. If there are no repeated corrections, return the current section unchanged and say so in the summary.\n\n# GEMINI.md\n' + readRule('GEMINI.md') + '\n\n# style-guide.md (current)\n' + guide;
  const r = await generate(o, system, [{ role: 'user', parts: [{ text: 'The repeated-corrections report:\n\n' + report + '\n\nThe owner says: learn from my edits.' }] }]);
  const j = parseJson(r.text);
  const section = String(j.section || '').trim();
  if (!section.startsWith(LEARNED_HEADING)) throw new ApiError('bad_output', 'The model returned a section without the expected heading.');
  const current = learnedSectionOf(guide);
  if (section === current) return { changed: false, summary: String(j.summary || '') };
  await store.setLearned(section, current);
  await loadRules();
  return { changed: true, summary: String(j.summary || '') };
}

// Rules file for passing learned rules to a colleague: {learnedSection, backups}.
async function exportRules() {
  await loadRules();
  return { uowa_rules: 1, exported_at: new Date().toISOString(), learnedSection: learnedSectionOf(readRule('style-guide.md')), backups: await store.getBackups() };
}

async function importRules(text) {
  let j; try { j = JSON.parse(text); } catch (e) { return { ok: false }; }
  const section = String((j && j.learnedSection) || '').trim();
  if (!section.startsWith(LEARNED_HEADING)) return { ok: false };
  await loadRules();
  await store.setLearned(section, learnedSectionOf(readRule('style-guide.md')));
  await loadRules();
  return { ok: true };
}

module.exports = { learnFromEdits, exportRules, importRules };
