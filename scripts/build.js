// Usage: node scripts/build.js drafts/<n>.json
// Builds drafts/<n>.html from draft-page.html and the JSON data file.
// ERROR = the page cannot be built. WARNING = the page is built, but fix the JSON and run again.
const fs = require('fs');
const path = require('path');
const openInBrowser = require('../shared/utils/open-in-browser.js');
const runChecks = require('../shared/checks/index.js');

const input = process.argv.slice(2).find(function (a) { return a.indexOf('--') !== 0; });
if (!input) { console.error('Usage: node scripts/build.js drafts/<n>.json'); process.exit(1); }

let data;
try { data = JSON.parse(fs.readFileSync(input, 'utf8')); }
catch (e) {
  console.error('ERROR: ' + input + ' is not valid JSON: ' + e.message);
  console.error('Fix the JSON (double quotes, no trailing commas, no line breaks inside strings) and run again.');
  process.exit(1);
}

const result = runChecks(data);
const errors = result.errors, warnings = result.warnings, notes = result.notes;
if (errors.length) {
  console.error('ERROR: the data file has problems:');
  errors.forEach(function (e) { console.error(' - ' + e); });
  process.exit(1);
}

const candidates = [path.join(__dirname, '..', 'shared', 'templates', 'draft-page.html')];
const templatePath = candidates.find(function (p) { return fs.existsSync(p); });
if (!templatePath) { console.error('ERROR: draft-page.html not found (looked in shared/templates/).'); process.exit(1); }
const template = fs.readFileSync(templatePath, 'utf8');
if (template.indexOf('/*__DATA__*/null') === -1) { console.error('ERROR: the template has no data marker.'); process.exit(1); }
// The styles live in draft-page.css next to the template (keeps both files small); inline them so the page stays one file.
const cssPath = path.join(path.dirname(templatePath), 'draft-page.css');
if (!fs.existsSync(cssPath)) { console.error('ERROR: draft-page.css not found next to ' + templatePath + '.'); process.exit(1); }
const css = fs.readFileSync(cssPath, 'utf8');
// The page logic lives in draft-page.js (the extension loads the same file); inline it too.
const jsPath = path.join(path.dirname(templatePath), 'draft-page.js');
if (!fs.existsSync(jsPath)) { console.error('ERROR: draft-page.js not found next to ' + templatePath + '.'); process.exit(1); }
const pageJs = fs.readFileSync(jsPath, 'utf8');

// draft_id lets the page name the file it saves (<draft_id>.edited.json). It is added to the page only, not to the source JSON.
const pageData = Object.assign({}, data, { draft_id: path.basename(input).replace(/\.json$/i, '') });
const json = JSON.stringify(pageData).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const out = input.replace(/\.json$/i, '') + '.html';
fs.writeFileSync(out, template.replace('/*__STYLE__*/', function () { return css; }).replace('/*__SCRIPT__*/', function () { return pageJs.replace(/<\/script/gi, '<\\/script'); }).replace('/*__DATA__*/null', function () { return json; }));
if (warnings.length) { console.warn('WARNINGS (the page was built, but fix these in the JSON and run the build again):'); warnings.forEach(function (w) { console.warn(' - ' + w); }); }
if (notes.length) { console.log('NOTES (not blocking; the draft already lists them under Choices to confirm):'); notes.forEach(function (n) { console.log(' - ' + n); }); }
console.log('OK: created ' + out + '  (template used: ' + templatePath + ')');

// Open the finished page in the default browser (only when there are no warnings).
// Skip with: NO_OPEN=1 node scripts/build.js ...   or   node scripts/build.js ... --no-open
if (!warnings.length && !process.env.NO_OPEN && !process.argv.includes('--no-open')) {
  openInBrowser(path.resolve(out));
}
