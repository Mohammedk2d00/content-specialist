// Find every draft that has an owner-edited copy (<name>.edited*.json) in the drafts folder.
const fs = require('fs');
const path = require('path');

function findPairs(DIR) {
  const files = fs.readdirSync(DIR);
  const pairs = [];
  files.filter(function (f) { return /\.json$/i.test(f) && !/\.edited/i.test(f); }).forEach(function (f) {
    const base = f.replace(/\.json$/i, '');
    const eds = files.filter(function (g) { return g.indexOf(base + '.edited') === 0 && /\.json$/i.test(g); })
      .map(function (g) { return { g: g, t: fs.statSync(path.join(DIR, g)).mtimeMs }; })
      .sort(function (a, b) { return b.t - a.t; });
    if (!eds.length) return;
    try {
      pairs.push({ id: base, orig: JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')), edit: JSON.parse(fs.readFileSync(path.join(DIR, eds[0].g), 'utf8')), editFile: eds[0].g });
    } catch (e) { console.warn('WARNING: skipped ' + base + ' (invalid JSON: ' + e.message + ')'); }
  });
  return pairs;
}

module.exports = findPairs;
