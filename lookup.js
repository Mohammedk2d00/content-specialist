// Usage: node lookup.js <words...> [--structure] [--category] [--lang ar|en] [--all]
// Searches the dashboard's Structure and Category Dep names (dashboard-lists.json), in Arabic or English.
//   node lookup.js nursing            node lookup.js التمريض
//   node lookup.js news --category --lang en
// Copy the names you pick exactly as printed. Every word you type must appear in the name.
const L = require('./lists.js');
const args = process.argv.slice(2);
const flag = function (f) { return args.indexOf(f) > -1; };
const lang = args.indexOf('--lang') > -1 ? args[args.indexOf('--lang') + 1] : null;
const words = args.filter(function (a, i) { return a.indexOf('--') !== 0 && args[i - 1] !== '--lang'; });
const d = L.load();
if (!d) { console.error('ERROR: dashboard-lists.json not found next to lookup.js'); process.exit(1); }
if (!words.length) { console.error('Usage: node lookup.js <words...> [--structure] [--category] [--lang ar|en] [--all]'); process.exit(1); }
const toks = words.join(' ').split(/\s+/).map(L.key).filter(Boolean);
const hit = function (text) { const k = L.key(text); return toks.every(function (t) { return k.indexOf(t) > -1; }); };
const max = flag('--all') ? 1e9 : 25;
const out = []; let found = 0;
if (!flag('--category')) {
  const rows = d.structures.filter(function (s) { return hit(s.ar) || hit(s.en); });
  if (rows.length) {
    out.push('STRUCTURES (' + rows.length + ')');
    rows.slice(0, max).forEach(function (s) {
      out.push('  ' + (s.n ? '#' + s.n : '#-') + '  ar: ' + s.ar + '  |  en: ' + (s.en || '(none in the dashboard)') +
        (s.ar_verified ? '' : '   [Arabic from screenshots, not checked against the dashboard]') + (s.note && s.en ? '   [' + s.note + ']' : ''));
    });
    if (rows.length > max) out.push('  ... ' + (rows.length - max) + ' more (add words or use --all)');
    out.push(''); found += rows.length;
  }
}
if (!flag('--structure')) {
  ['ar', 'en'].forEach(function (l) {
    if (lang && lang !== l) return;
    const rows = (d.categories[l] || []).filter(function (c) { return hit(c.name); });
    if (!rows.length) return;
    out.push('CATEGORY DEP, ' + (l === 'ar' ? 'Arabic' : 'English') + ' (' + rows.length + ')');
    rows.slice(0, max).forEach(function (c) { out.push('  #' + c.numbers[0] + '  ' + c.name + (c.check ? '   [CHECK: ' + c.check + ']' : '')); });
    if (rows.length > max) out.push('  ... ' + (rows.length - max) + ' more (add words or use --all)');
    out.push(''); found += rows.length;
  });
}
if (!found) {
  console.log('No match for "' + words.join(' ') + '".');
  console.log('Do not invent a name. Try a shorter or different word (Arabic or English). The lists are missing about 8 Structures and 10 Categories; if the name is not here, pick the closest listed name and put it under "Choices to confirm".');
} else console.log(out.join('\n').trim());
