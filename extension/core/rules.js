// Loads the rule files bundled in extension/rules/ (copied there by build-extension.js) and hands them to
// the fs shim, so the prompt and the shared checks read the same files the project keeps in the repo.
// The learned rules saved in this browser replace the learned section of the bundled style guide.
const fs = require('fs');
const store = require('./store.js');

const LEARNED_HEADING = "## Learned from the owner's edits";
let cache = null;

async function fetchText(name) {
  const r = await fetch(chrome.runtime.getURL('rules/' + name));
  if (!r.ok) throw new Error('Missing rule file: ' + name);
  return r.text();
}

// Swap the learned section (heading to end of file) for the saved one.
function withLearned(guide, section) {
  if (!section) return guide;
  const i = guide.indexOf(LEARNED_HEADING);
  return (i >= 0 ? guide.slice(0, i) : guide.replace(/\s*$/, '\n\n')) + section.trim() + '\n';
}

function learnedSectionOf(guide) {
  const i = guide.indexOf(LEARNED_HEADING);
  return i >= 0 ? guide.slice(i).trim() : LEARNED_HEADING + '\n';
}

// Returns {files: {name: text}, examples: [names]}; call again after the learned rules change.
async function loadRules() {
  if (!cache) {
    const index = JSON.parse(await fetchText('index.json'));
    const files = {};
    await Promise.all(index.files.map(async n => { files[n] = await fetchText(n); }));
    cache = { files, examples: index.examples, bundledGuide: files['style-guide.md'] };
  }
  cache.files['style-guide.md'] = withLearned(cache.bundledGuide, await store.getLearned());
  // under plain Node (tests) fs is the real one and the checks read the repo files directly
  if (fs.preload) Object.keys(cache.files).forEach(n => fs.preload(n, cache.files[n]));
  return cache;
}

const readRule = name => (cache && cache.files[name]) || '';

module.exports = { LEARNED_HEADING, loadRules, readRule, learnedSectionOf };
