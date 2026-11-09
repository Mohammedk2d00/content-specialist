// Shared helpers for dashboard-lists.json (Structure and Category Dep names of the UOWA dashboard).
// Used by lookup.js (search) and build.js (checks). Depends only on utils/arabic.js.
const fs = require('fs');
const path = require('path');
const AR = require('./utils/arabic.js');
let DATA;
function load() {
  if (DATA !== undefined) return DATA;
  try { DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules', 'dashboard-lists.json'), 'utf8')); } catch (e) { DATA = null; }
  return DATA;
}
// comparison key: ignores case, Arabic marks, hamza/alef and ta marbuta variants, punctuation, extra spaces
function key(s) {
  return AR.foldLetters(AR.stripMarks(String(s == null ? '' : s).normalize('NFC').replace(/&amp;|amp;/gi, '&')))
    .replace(/[\u2018\u2019\u201C\u201D"'`.:;,\u060C\u061B\u061F?!()\[\]&]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = []; for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function close(a, b) { // a, b are keys
  if (!a || !b) return false;
  if (a.length >= 4 && b.length >= 4 && (a.indexOf(b) > -1 || b.indexOf(a) > -1)) return true;
  return lev(a, b) <= Math.max(2, Math.floor(Math.min(a.length, b.length) * 0.15));
}
// entries: [{k: key, entry}]. Returns {exact, near[]}
function find(value, entries) {
  const k = key(value); if (!k) return { exact: null, near: [] };
  const exact = entries.filter(function (e) { return e.k === k; })[0];
  if (exact) return { exact: exact.entry, near: [] };
  const near = entries.filter(function (e) { return close(k, e.k); }).slice(0, 3).map(function (e) { return e.entry; });
  return { exact: null, near: near };
}
function structureEntries(field) {
  const d = load(); if (!d) return [];
  return d.structures.filter(function (s) { return s[field]; }).map(function (s) { return { k: key(s[field]), entry: s }; });
}
function categoryEntries(lang) {
  const d = load(); if (!d) return [];
  return ((d.categories || {})[lang] || []).map(function (c) { return { k: key(c.name), entry: c }; });
}
module.exports = { load: load, key: key, find: find, structureEntries: structureEntries, categoryEntries: categoryEntries };
