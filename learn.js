// Usage: node learn.js [drafts-folder] [--min 2] [--all]
//
// Learns from the owner's edits.
// For every drafts/<name>.json that has an owner-edited copy drafts/<name>.edited*.json
// (the page saves it when the owner presses Approved), this script compares the two,
// finds corrections that REPEAT across drafts, and writes feedback/report.md.
// The agent then turns the repeated corrections into rules in style-guide.md.
//
//   --min N   a correction must appear in at least N different drafts to count as a pattern (default 2)
//   --all     also read posts the owner did not press Approved on (default: approved posts only)
//
// It never changes a draft and never touches style-guide.md. It is safe to run any number of times.
const fs = require('fs');
const path = require('path');
const findPairs = require('./learn/pairs.js');
const comparePairs = require('./learn/compare.js').comparePairs;
const P = require('./learn/patterns.js');
const buildReport = require('./learn/report.js');

const args = process.argv.slice(2);
const val = function (name, d) { const i = args.indexOf(name); return i > -1 && args[i + 1] ? args[i + 1] : d; };
const MIN = Math.max(1, parseInt(val('--min', '2'), 10) || 2);
const ALL = args.includes('--all');
const dirArg = args.find(function (a) { return !a.startsWith('--') && fs.existsSync(a) && fs.statSync(a).isDirectory(); });
const DIR = dirArg || path.join(__dirname, 'drafts');
const OUT_DIR = path.join(__dirname, 'feedback');

if (!fs.existsSync(DIR)) { console.error('ERROR: folder not found: ' + DIR); process.exit(1); }
const pairs = findPairs(DIR);
if (!pairs.length) {
  console.log('No edited drafts found in ' + DIR + '.');
  console.log('Open a draft page, edit it, go to Media and press Approved. The page saves <draft>.edited.json to your Downloads folder.');
  console.log('Move that file into the drafts folder next to the original, then run this again.');
  process.exit(0);
}

const posts = comparePairs(pairs, ALL);
if (!posts.length) { console.log('Edited files found, but no approved posts in them. Press Approved on the page (or run with --all).'); process.exit(0); }

const report = buildReport(pairs, posts, P.findPatterns(posts, MIN), MIN, ALL);
fs.mkdirSync(OUT_DIR, { recursive: true });
const outFile = path.join(OUT_DIR, 'report.md');
fs.writeFileSync(outFile, report.text);
console.log('OK: wrote ' + outFile);
console.log(P.draftsOf(posts).length + ' edited draft(s), ' + posts.length + ' post(s) compared, ' + report.ruleCount + ' repeated correction(s) found (threshold: ' + MIN + ' drafts).');
