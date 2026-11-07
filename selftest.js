// Usage: node selftest.js [--keep]
// Tests everything that does not need a browser. Run it from the project folder.
// It works on a temporary copy, so your drafts and files are never changed.
//   --keep   do not delete the temporary folder (to look at the files it made)
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const ROOT = __dirname;
const KEEP = process.argv.includes('--keep');
const results = [];
let section = '';

function test(name, fn) {
  let msg = '';
  try { const r = fn(); if (r !== undefined && r !== true) msg = String(r); } catch (e) { msg = e.message; }
  results.push({ section: section, name: name, ok: !msg, msg: msg });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function run(args, cwd, extraEnv) {
  const r = cp.spawnSync(process.execPath, args, { cwd: cwd, encoding: 'utf8', env: Object.assign({}, process.env, { NO_OPEN: '1' }, extraEnv || {}) });
  return { out: (r.stdout || '') + (r.stderr || ''), code: r.status };
}
const read = function (p) { return fs.readFileSync(p, 'utf8'); };
const has = function (f) { return fs.existsSync(path.join(ROOT, f)); };

// ---------------------------------------------------------------- 1. files
const REQUIRED = ['build.js', 'templates/draft-page.html', 'templates/draft-page.css', 'sample-draft.json', 'GEMINI.md', 'style-guide.md', 'latin-allowlist.txt',
  'learn.js', 'lookup.js', 'lists.js', 'dashboard-lists.json', 'extension/manifest.json', 'extension/content.js', 'utils', 'checks', 'learn'];
section = '1. Project files';
REQUIRED.forEach(function (f) { test(f + ' exists', function () { need(has(f), 'missing. Apply the patches (apply-v4-patch.js, apply-v4-lists-patch.js).'); }); });
test('examples/ has the example posts', function () { need(has('examples') && fs.readdirSync(path.join(ROOT, 'examples')).length >= 10, 'examples/ folder is missing or incomplete'); });
if (results.some(function (r) { return !r.ok; })) { report(null); process.exit(1); }

// ---------------------------------------------------------------- 2. static checks
section = '2. Code and content';
const MODULES = ['utils', 'checks', 'learn'].reduce(function (a, d) { return a.concat(fs.readdirSync(path.join(ROOT, d)).filter(function (f) { return /\.js$/.test(f); }).map(function (f) { return d + '/' + f; })); }, []);
['build.js', 'learn.js', 'lookup.js', 'lists.js', 'extension/content.js'].concat(MODULES).forEach(function (f) {
  test(f + ' has no syntax errors', function () { const r = run(['--check', path.join(ROOT, f)], ROOT); need(r.code === 0, r.out.trim().split('\n')[0]); });
});
test('extension/manifest.json is valid (Manifest V3)', function () { const m = JSON.parse(read(path.join(ROOT, 'extension/manifest.json'))); need(m.manifest_version === 3, 'manifest_version is not 3'); });
test('templates/draft-page.html has the data marker and the edit-saving code', function () {
  const h = read(path.join(ROOT, 'templates', 'draft-page.html'));
  ['/*__DATA__*/null', '/*__STYLE__*/', 'exportEdits', 'Save edits file', 'حفظ ملف التعديلات'].forEach(function (s) { need(h.indexOf(s) > -1, 'missing in draft-page.html: ' + s); });
});
test('GEMINI.md has the learning and the names sections', function () {
  const g = read(path.join(ROOT, 'GEMINI.md'));
  ['Learning from the owner\'s edits', 'Structure and Category names'].forEach(function (s) { need(g.indexOf(s) > -1, 'missing in GEMINI.md: ' + s); });
});
test('style-guide.md has the "Learned from the owner\'s edits" section', function () { need(read(path.join(ROOT, 'style-guide.md')).indexOf('## Learned from the owner\'s edits') > -1, 'section missing'); });
test('dashboard-lists.json is complete and has the key names', function () {
  const d = JSON.parse(read(path.join(ROOT, 'dashboard-lists.json')));
  need(d.structures.length >= 120, 'only ' + d.structures.length + ' structures');
  need(d.categories.ar.length >= 400 && d.categories.en.length >= 400, 'category lists look short');
  const has2 = function (arr, f, v) { return arr.some(function (x) { return x[f] === v; }); };
  need(has2(d.structures, 'en', 'College of Nursing') && has2(d.structures, 'ar', 'كلية التمريض'), 'College of Nursing missing');
  need(has2(d.categories.en, 'name', 'College News') && has2(d.categories.ar, 'name', 'أخبار الكلية'), 'College News / أخبار الكلية missing');
});

// ---------------------------------------------------------------- temp copy
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'uowa-selftest-'));
fs.mkdirSync(path.join(TMP, 'templates'));
['build.js', 'templates/draft-page.html', 'templates/draft-page.css', 'sample-draft.json', 'latin-allowlist.txt', 'learn.js', 'lookup.js', 'lists.js', 'dashboard-lists.json'].forEach(function (f) { fs.copyFileSync(path.join(ROOT, f), path.join(TMP, f)); });
['utils', 'checks', 'learn'].forEach(function (d) { fs.cpSync(path.join(ROOT, d), path.join(TMP, d), { recursive: true }); });
fs.mkdirSync(path.join(TMP, 'drafts'));
const BASE = JSON.parse(read(path.join(TMP, 'sample-draft.json')));
let counter = 0;
function build(mutate, name) {
  const d = JSON.parse(JSON.stringify(BASE)); if (mutate) mutate(d);
  const f = path.join(TMP, 'drafts', (name || 't' + (++counter)) + '.json');
  fs.writeFileSync(f, typeof d === 'string' ? d : JSON.stringify(d));
  const r = run(['build.js', path.relative(TMP, f)], TMP);
  r.html = fs.existsSync(f.replace(/\.json$/, '.html')) ? read(f.replace(/\.json$/, '.html')) : '';
  r.warn = r.out.split('\n').filter(function (l) { return /^ - /.test(l); }).join('\n');
  r.hasWarnings = /WARNINGS/.test(r.out);
  return r;
}
const ar = function (d) { return d.posts.filter(function (p) { return p.dir === 'rtl'; })[0]; };
const en = function (d) { return d.posts.filter(function (p) { return p.dir === 'ltr'; })[0]; };
function expectWarning(label, mutate, pattern) {
  test(label, function () { const r = build(mutate); need(r.hasWarnings && pattern.test(r.warn), 'expected a warning matching ' + pattern + '\n      got: ' + (r.warn || '(no warnings)')); });
}

// ---------------------------------------------------------------- 3. build
section = '3. Building a draft page (build.js)';
test('a valid draft builds with no warnings', function () { const r = build(null, 'valid'); need(r.code === 0 && /OK: created/.test(r.out) && !r.hasWarnings, 'build output:\n' + r.out); });
test('the page contains the data and the draft name', function () { const h = build(null, 'valid2').html; need(h.indexOf('Blood donation campaign') > -1 && h.indexOf('"draft_id":"valid2"') > -1, 'data or draft_id not found in the page'); });
test('invalid JSON gives an ERROR and no page', function () { const r = build(function () {}, 'bad'); fs.writeFileSync(path.join(TMP, 'drafts', 'bad2.json'), '{ "posts": [ '); const r2 = run(['build.js', 'drafts/bad2.json'], TMP); need(r2.code === 1 && /ERROR/.test(r2.out), 'expected exit code 1 and ERROR, got: ' + r2.out); });
expectWarning('Arabic post with English letters is flagged', function (d) { ar(d).title += ' hello'; }, /English letters/);
expectWarning('hype word is flagged', function (d) { en(d).content_html = en(d).content_html.replace('<p>', '<p>An outstanding effort. '); }, /hype/i);
expectWarning('exclamation mark is flagged', function (d) { en(d).content_html = en(d).content_html.replace('</p>', '!</p>'); }, /exclamation/);
test('Arabic post with &nbsp; is not flagged as English', function () { const r = build(function (d) { ar(d).content_html = '<p>&nbsp;</p>' + ar(d).content_html; }); need(!/English letters/.test(r.warn), 'got: ' + r.warn); });
expectWarning('[placeholder] is flagged', function (d) { en(d).content_html = en(d).content_html.replace('<p>', '<p>[date] '); }, /placeholder/);
expectWarning('title longer than 8 words is flagged', function (d) { en(d).title = 'one two three four five six seven eight nine ten'; }, /words/);
expectWarning('title with a final full stop is flagged', function (d) { en(d).title += '.'; }, /full stop/);
expectWarning('a tag count outside 3 to 6 is flagged', function (d) { en(d).tags = ['one']; }, /tags/);
expectWarning('a tag the editor does not allow (<h1>) is flagged', function (d) { en(d).content_html += '<h1>Big</h1>'; }, /does not allow/);
expectWarning('an invented number is flagged', function (d) { en(d).content_html = en(d).content_html.replace('<p>', '<p>About 250 students took part. '); }, /number "250"/);
expectWarning('an invented name after a title is flagged', function (d) { en(d).content_html = en(d).content_html.replace('<p>', '<p>Dr. Kareem Salman visited. '); }, /Never invent names/);
test('a number given by the owner (source_facts) is accepted', function () {
  const r = build(function (d) { d.source_facts = ['250 students']; ar(d).content_html = ar(d).content_html.replace('<p>', '<p>٢٥٠ طالباً. '); en(d).content_html = en(d).content_html.replace('<p>', '<p>250 students took part. '); });
  need(!/number "/.test(r.warn), 'number was flagged although it is in source_facts:\n' + r.warn);
});
expectWarning('different numbers in Arabic and English are flagged', function (d) { d.source_facts = ['250 students', '300 students']; ar(d).content_html = ar(d).content_html.replace('<p>', '<p>٣٠٠ طالباً. '); en(d).content_html = en(d).content_html.replace('<p>', '<p>250 students took part. '); }, /different numbers/);
expectWarning('review and review_ar with different lengths are flagged', function (d) { d.review.confirm.push('extra'); }, /review\.confirm/);

// ---------------------------------------------------------------- 4. dashboard names
section = '4. Structure and Category names (lists + build checks)';
test('lookup finds a Structure in English', function () { const r = run(['lookup.js', 'nursing', '--structure'], TMP); need(/College of Nursing/.test(r.out), r.out); });
test('lookup finds a Structure in Arabic', function () { const r = run(['lookup.js', 'التمريض', '--structure'], TMP); need(/كلية التمريض/.test(r.out), r.out); });
test('lookup finds a Category and respects --lang', function () { const r = run(['lookup.js', 'news', '--category', '--lang', 'en'], TMP); need(/College News/.test(r.out) && !/CATEGORY DEP, Arabic/.test(r.out), r.out); });
test('lookup says "No match" and tells the agent not to invent', function () { const r = run(['lookup.js', 'zzzzqq'], TMP); need(/No match/.test(r.out) && /Do not invent/.test(r.out), r.out); });
expectWarning('Structure spelled wrongly is flagged', function (d) { ar(d).structure_ar = 'كلية التمريظ'; }, /structure_ar must be written exactly/);
expectWarning('English Structure with the wrong letter case is flagged', function (d) { en(d).structure = 'College of nursing'; }, /structure must be written exactly/);
expectWarning('Structure that does not match its Arabic name is flagged', function (d) { en(d).structure = 'College of Medicine'; }, /structure must be written exactly/);
expectWarning('a near-miss Category is flagged with a suggestion', function (d) { en(d).category = 'College Newss'; }, /Closest: .*College News/);
expectWarning('an unknown Category that is not under "Choices to confirm" is flagged', function (d) { en(d).category = 'Campus Gardening Club'; }, /not in dashboard-lists\.json/);
test('an unknown Category listed under "Choices to confirm" becomes a NOTE, not a warning', function () {
  const r = build(function (d) { en(d).category = 'Campus Gardening Club'; d.review.confirm.push('Category: Campus Gardening Club'); d.review_ar.confirm.push('القسم: نادي حدائق الحرم'); });
  need(!r.hasWarnings && /NOTES/.test(r.out), 'expected NOTES and no WARNINGS, got:\n' + r.out);
});
expectWarning('a doubtful ([CHECK]) Category is flagged', function (d) { ar(d).category = 'الجداول1'; }, /doubtful/);

// ---------------------------------------------------------------- 5. learning
section = '5. Learning from the owner\'s edits (learn.js)';
test('with no edited files it explains what to do', function () { const r = run(['learn.js'], TMP); need(r.code === 0 && /No edited drafts found/.test(r.out), r.out); });
(function () {
  const paras = function (extra) { return ['<p>The college held a training day for students.</p>', '<p>The day included practical work in the laboratories ' + (extra || '') + '.</p>', '<p>The Deanship of the college confirmed that the activity supports its plan.</p>', '<p>The college aims to develop skills in Holy Karbala and across Iraq.</p>'].join(''); };
  const names = ['lrn_a', 'lrn_b', 'lrn_c'];
  names.forEach(function (n, i) {
    const orig = JSON.parse(JSON.stringify(BASE)); en(orig).content_html = paras(); en(orig).tags = ['College of Nursing', 'training', 'students', 'Warith Al-Anbiyaa University'];
    fs.writeFileSync(path.join(TMP, 'drafts', n + '.json'), JSON.stringify(orig));
    const ed = JSON.parse(JSON.stringify(orig));
    en(ed).content_html = paras(i === 0 ? 'with 45 students' : '').replace('<p>The Deanship of the college confirmed that the activity supports its plan.</p>', '').replace(' and across Iraq', '');
    en(ed).tags = en(ed).tags.filter(function (t) { return t !== 'Warith Al-Anbiyaa University'; });
    ed.owner_approved_at = i === 2 ? { rtl: '2026-11-04T10:00:00Z' } : { rtl: '2026-11-04T10:00:00Z', ltr: '2026-11-04T10:00:00Z' }; // draft c: English NOT approved
    fs.writeFileSync(path.join(TMP, 'drafts', n + '.edited.json'), JSON.stringify(ed));
  });
  const r = run(['learn.js'], TMP);
  const rep = fs.existsSync(path.join(TMP, 'feedback', 'report.md')) ? read(path.join(TMP, 'feedback', 'report.md')) : '';
  test('learn.js runs and writes feedback/report.md', function () { need(r.code === 0 && /OK: wrote/.test(r.out) && rep, r.out); });
  test('it skips posts the owner did not approve', function () { need(/English posts \(2 post\(s\) in 2 draft\(s\)\)/.test(rep), 'expected 2 English posts; report starts:\n' + rep.slice(0, 400)); });
  test('it finds the paragraph deleted in every draft', function () { need(/Paragraph 3: deleted in 2 of 2/.test(rep), 'paragraph pattern not found'); });
  test('it finds the phrase the owner removed in every draft', function () { need(/Avoid .*across Iraq/.test(rep), 'phrase pattern not found'); });
  test('it finds the tag the owner removed in every draft', function () { need(/Tag removed: .Warith Al-Anbiyaa University/.test(rep), 'tag pattern not found'); });
  test('a fact only one draft got (45) is listed as a missing detail, not a rule', function () {
    const i = rep.indexOf('Specifics the owner supplied'), rules = rep.slice(0, rep.indexOf('## All edits'));
    need(i > -1 && /added .with 45 students/.test(rep.slice(i)) && !/Avoid .*45/.test(rules), 'expected 45 under "Specifics the owner supplied" only');
  });
  test('the draft-by-draft section is included', function () { need(/## All edits, one by one/.test(rep) && /lrn_a/.test(rep), 'section missing'); });
})();

// ---------------------------------------------------------------- 6. your own drafts
section = '6. Your existing drafts';
(function () {
  const dir = path.join(ROOT, 'drafts');
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f) && !/\.edited/.test(f); });
  test(files.length + ' existing draft(s) build without an ERROR (warnings are only counted)', function () {
    let warned = 0; const errs = [];
    files.forEach(function (f) {
      fs.copyFileSync(path.join(dir, f), path.join(TMP, 'drafts', 'mine_' + f));
      const r = run(['build.js', 'drafts/mine_' + f], TMP);
      if (r.code !== 0 || !/OK: created/.test(r.out)) errs.push(f + ': ' + r.out.split('\n')[0]); else if (/WARNINGS/.test(r.out)) warned++;
    });
    need(!errs.length, errs.join('\n      '));
    results[results.length - 1].note = warned ? warned + ' of them have warnings (older drafts written before the newer checks; rebuild after fixing)' : '';
  });
})();

// ---------------------------------------------------------------- 7. fast engine
section = '7. Fast engine (fake network, tests/engine.test.js)';
(function () {
  const r = run([path.join(ROOT, 'tests', 'engine.test.js'), TMP], TMP);
  const lines = r.out.split('\n').filter(function (l) { return /^(PASS|FAIL|SKIP) /.test(l); });
  lines.forEach(function (l) { test(l.slice(5).replace(/: .*$/, ''), function () { need(!/^FAIL/.test(l), l.slice(5)); }); });
  if (r.code !== 0 && !lines.some(function (l) { return /^FAIL/.test(l); })) test('engine test runs', function () { need(false, r.out.trim()); });
})();

// ---------------------------------------------------------------- 8. patch updater
section = '8. Patch updater (tests/patch.test.js)';
(function () {
  const r = run([path.join(ROOT, 'tests', 'patch.test.js')], TMP);
  const lines = r.out.split('\n').filter(function (l) { return /^(PASS|FAIL|SKIP) /.test(l); });
  lines.forEach(function (l) { test(l.slice(5).replace(/: .*$/, ''), function () { need(!/^FAIL/.test(l), l.slice(5)); }); });
  if (r.code !== 0 && !lines.some(function (l) { return /^FAIL/.test(l); })) test('patch test runs', function () { need(false, r.out.trim()); });
})();

// ---------------------------------------------------------------- report
function report(done) {
  let last = '';
  results.forEach(function (r) {
    if (r.section !== last) { console.log('\n' + r.section); last = r.section; }
    console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' + r.name);
    if (!r.ok) console.log('        ' + String(r.msg).split('\n').join('\n        '));
    if (r.ok && r.note) console.log('        note: ' + r.note);
  });
  const bad = results.filter(function (r) { return !r.ok; }).length;
  console.log('\n' + (results.length - bad) + ' passed, ' + bad + ' failed.');
  if (done) {
    console.log('\nNOT covered here (needs a browser, see the checklist): the draft page buttons, the Approved download, and the extension on the real dashboard.');
    if (KEEP || bad) console.log('Temporary files kept in: ' + TMP);
  }
}
report(true);
if (!KEEP && !results.some(function (r) { return !r.ok; })) fs.rmSync(TMP, { recursive: true, force: true });
process.exit(results.some(function (r) { return !r.ok; }) ? 1 : 0);
