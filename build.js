// Usage: node tools/build.js drafts/<n>.json   (or: node build.js drafts/<n>.json)
// Builds drafts/<n>.html from draft-page.html and the JSON data file.
// ERROR = the page cannot be built. WARNING = the page is built, but fix the JSON and run again.
const fs = require('fs');
const path = require('path');

const input = process.argv.slice(2).find(function (a) { return a.indexOf('--') !== 0; });
if (!input) { console.error('Usage: node tools/build.js drafts/<n>.json'); process.exit(1); }

let data;
try { data = JSON.parse(fs.readFileSync(input, 'utf8')); }
catch (e) {
  console.error('ERROR: ' + input + ' is not valid JSON: ' + e.message);
  console.error('Fix the JSON (double quotes, no trailing commas, no line breaks inside strings) and run again.');
  process.exit(1);
}

const errors = [], warnings = [], notes = [];
const posts = data && Array.isArray(data.posts) ? data.posts : [];
if (!posts.length) errors.push('"posts" must be a non-empty array');

const ARABIC = /[\u0600-\u06FF]/;
function readAllowlist() {
  try {
    return fs.readFileSync(path.join(__dirname, 'latin-allowlist.txt'), 'utf8').split(/\r?\n/)
      .map(function (l) { return l.trim(); }).filter(function (l) { return l && l[0] !== '#'; });
  } catch (e) { return []; }
}
const ALLOW = readAllowlist().sort(function (a, b) { return b.length - a.length; })
  .map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
const ALLOW_RE = new RegExp('(?:^|[^A-Za-z0-9])(?:' + ALLOW.concat(['Q[1-4]']).join('|') + ')(?![A-Za-z0-9])', 'gi');
// LATIN.test(x) is true only when x has English letters that are NOT an allowlisted official name
const LATIN = { test: function (x) { return /[A-Za-z]/.test(String(x || '').replace(ALLOW_RE, ' ')); } };
const strip = function (s) { return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&(?:[a-z]+|#\d+);/gi, ' '); };

posts.forEach(function (p, i) {
  const w = 'posts[' + i + ']';
  if (!p || typeof p !== 'object') { errors.push(w + ' must be an object'); return; }
  ['language', 'dir', 'structure', 'category', 'title'].forEach(function (k) { if (!p[k]) errors.push(w + '.' + k + ' is missing'); });
  if (p.dir && p.dir !== 'rtl' && p.dir !== 'ltr') errors.push(w + '.dir must be "rtl" or "ltr"');
  if (!p.content_html && !p.sub_content && !(p.tags && p.tags.length)) errors.push(w + ' has no content_html, sub_content or tags');
  if (p.tags && !Array.isArray(p.tags)) errors.push(w + '.tags must be an array');
});

if (!errors.length) {
  const seen = {};
  posts.forEach(function (p, i) {
    const w = 'posts[' + i + ']';
    if (seen[p.dir]) warnings.push(w + ': two posts have dir "' + p.dir + '". The page shows one post per language; the second one is not reachable.');
    seen[p.dir] = true;
    if (/\[[^\]]*\]/.test(strip(p.title + ' ' + p.sub_content + ' ' + p.content_html))) warnings.push(w + ' contains a [bracketed placeholder]. Remove it.');
    (String(p.content_html || '').match(/<\/?([a-z0-9]+)/gi) || []).forEach(function (m) {
      if (!/^(p|h2|h3|ul|ol|li|strong|a|br)$/i.test(m.replace(/^<\/?/, ''))) warnings.push(w + '.content_html uses a tag the dashboard editor does not allow: ' + m + '>');
    });
    if (p.tags && p.tags.length && (p.tags.length < 3 || p.tags.length > 6)) warnings.push(w + ' has ' + p.tags.length + ' tags (expected 3 to 6)');
    if (p.dir === 'rtl') {
      if (!p.structure_ar) warnings.push(w + '.structure_ar is missing (the Arabic name of the Structure, shown on the Arabic page)');
      // the Arabic page must not show a single English letter
      ['title', 'category', 'structure_ar', 'sub_content', 'content_html', 'image_suggestion', 'attachments'].forEach(function (k) {
        if (!(k === 'structure_ar' && p.structure_ar === p.structure) && LATIN.test(strip(p[k]))) warnings.push(w + '.' + k + ' has English letters. The Arabic page must be fully Arabic.');
      });
      (p.tags || []).forEach(function (tg) { if (LATIN.test(tg)) warnings.push(w + '.tags has English letters: ' + tg); });
      if (!ARABIC.test(p.title || '')) warnings.push(w + ' is rtl but its title has no Arabic letters');
    } else if (ARABIC.test(p.title || '')) {
      warnings.push(w + ' is ltr but its title has Arabic letters');
    }
  });
  // ---- style checks (from style-guide.md) ----
  const HYPE_EN = /\b(exceptional|outstanding|distinguished|remarkable|stimulating|unparalleled|world-class|groundbreaking|extraordinary)\b/i;
  const HYPE_AR = /(استثنائي|منقطع النظير|لا مثيل|الأفضل على الإطلاق)/;
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  const westDigits = function (x) { return String(x).replace(/[\u0660-\u0669]/g, function (d) { return d.charCodeAt(0) - 0x0660; }); };
  const digitsOf = function (p) { return (westDigits(strip(p.title + ' ' + p.sub_content + ' ' + p.content_html)).match(/\d+/g) || []).sort().join(','); };
  posts.forEach(function (p, i) {
    const w = 'posts[' + i + ']', body = strip(p.title + ' ' + p.sub_content + ' ' + p.content_html);
    const hype = body.match(p.dir === 'rtl' ? HYPE_AR : HYPE_EN);
    if (hype) warnings.push(w + ' uses hype wording "' + hype[0] + '". The style guide says no hype; use plain factual wording.');
    if (/!/.test(body) || EMOJI.test(body)) warnings.push(w + ' has an exclamation mark or an emoji. The style guide does not allow them.');
    const tw = String(p.title || '').trim().split(/\s+/).filter(Boolean).length;
    if (tw > 8) warnings.push(w + '.title has ' + tw + ' words. The style guide says usually 3 to 8; shorten it.');
    if (/[.\u06D4]\s*$/.test(String(p.title || ''))) warnings.push(w + '.title ends with a full stop. Remove it.');
    if (p.dir === 'ltr' && /news/i.test(p.category || '') && /<p>/i.test(p.content_html || '')) {
      const n = strip(p.content_html).trim().split(/\s+/).filter(Boolean).length;
      if (n < 100 || n > 240) warnings.push(w + ' body has ' + n + ' words. The style guide says about 120 to 220 for English news.');
    }
  });
  const ar = posts.filter(function (p) { return p.dir === 'rtl'; })[0], en = posts.filter(function (p) { return p.dir === 'ltr'; })[0];
  if (ar && en && digitsOf(ar) !== digitsOf(en)) warnings.push('The Arabic and English posts contain different numbers (Arabic: ' + (digitsOf(ar) || 'none') + ' | English: ' + (digitsOf(en) || 'none') + '). They must have the same facts.');
  // ---- anti-hallucination: numbers and titled names must come from the owner's request ----
  if (!Array.isArray(data.source_facts)) {
    warnings.push('"source_facts" is missing. Copy every fact the owner gave (names with titles, numbers, dates, places) into it, word for word; use [] if the owner gave only a title.');
  } else {
    const nz = function (x) { return westDigits(strip(x)).replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627').replace(/\u0649/g, '\u064A').replace(/\u0629/g, '\u0647').toLowerCase(); };
    const src = nz([].concat(data.source_facts, data.request_title || '', data.request_title_ar || '').join(' '));
    const srcNums = src.match(/\d+/g) || [];
    const srcWords = {};
    src.split(/[^\p{L}\p{N}]+/u).forEach(function (t) { if (t) srcWords[t] = 1; });
    const STOP_EN = /^(assistant|associate|dean|head|director|vice|deputy|president|chair|lecturer|college|university|department|deanship|of|the|and)$/i;
    const STOP_AR = /^(في|من|على|الى|إلى|عن|معاون|عميد|رئيس|مدير|الكلية|الجامعة|الاستاذ|الأستاذ|المساعد|السيد|السيدة|الدكتور|الدكتورة|الذي|التي|وعميد|وكيل|مساعد)$/;
    posts.forEach(function (p, i) {
      const w = 'posts[' + i + ']', orig = strip(p.title + ' ' + p.sub_content + ' ' + p.content_html), seen = {};
      (nz(orig).match(/\d+/g) || []).forEach(function (n) {
        if (srcNums.indexOf(n) < 0 && !seen[n]) { seen[n] = 1; warnings.push(w + ' has the number "' + n + '" which is not in source_facts or the request title. Remove it, or add it to source_facts only if the owner gave it.'); }
      });
      const names = [], reEn = /\b(?:Dr|Prof|Professor|Eng)\.?\s+((?:[A-Z][A-Za-z'-]+\s?){1,3})/g, reAr = /(?:\u0627\u0644\u062F\u0643\u062A\u0648\u0631\u0629|\u0627\u0644\u062F\u0643\u062A\u0648\u0631|\u062F\.)\s+([\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+){0,2})/g;
      let m;
      while ((m = reEn.exec(orig))) m[1].trim().split(/\s+/).filter(function (t) { return !STOP_EN.test(t); }).slice(0, 2).forEach(function (t) { names.push(t); });
      while ((m = reAr.exec(orig))) m[1].trim().split(/\s+/).filter(function (t) { return !STOP_AR.test(t); }).slice(0, 2).forEach(function (t) { names.push(t); });
      names.forEach(function (t) {
        const k = nz(t).replace(/^\u0648(?=.{3,})/, '');
        if (!srcWords[nz(t)] && !srcWords[k] && !seen['n' + k]) { seen['n' + k] = 1; warnings.push(w + ' names "' + t + '" after a title, but that name is not in source_facts or the request title. Never invent names.'); }
      });
    });
  }
  // ---- Structure and Category names must be real dashboard names (dashboard-lists.json, searched with lookup.js) ----
  let LISTS = null; try { LISTS = require('./lists.js'); if (!LISTS.load()) LISTS = null; } catch (e) { LISTS = null; }
  if (LISTS) {
    const sEn = LISTS.structureEntries('en'), sAr = LISTS.structureEntries('ar');
    const acknowledged = function (v) { const hay = JSON.stringify([(data.review || {}).confirm || [], (data.review_ar || {}).confirm || []]).toLowerCase(); return hay.indexOf(String(v).toLowerCase()) > -1; };
    const unknown = function (w, what, value, r, field) {
      if (r.near.length) { warnings.push(w + '.' + what + ' "' + value + '" is not a dashboard name. Closest: ' + r.near.map(function (x) { return '"' + x[field] + '"'; }).join(', ') + '. Use one of them exactly, or search with: node lookup.js <word>'); return; }
      const msg = w + '.' + what + ' "' + value + '" is not in dashboard-lists.json (the list is missing about 8 Structures and 10 Categories).';
      if (acknowledged(value)) notes.push(msg + ' It is listed under Choices to confirm.');
      else warnings.push(msg + ' Search with node lookup.js first. If the owner really named it, keep it and add it to review.confirm and review_ar.confirm; otherwise use a listed name.');
    };
    posts.forEach(function (p, i) {
      const w = 'posts[' + i + ']';
      const ea = LISTS.find(p.structure_ar, sAr), ee = LISTS.find(p.structure, sEn), E = ea.exact || ee.exact;
      if (E) {
        if (E.ar && E.ar !== p.structure_ar) warnings.push(w + '.structure_ar must be written exactly "' + E.ar + '" (the extension types it into the dashboard).');
        if (E.en && E.en !== p.structure) warnings.push(w + '.structure must be written exactly "' + E.en + '" (the dashboard English name for "' + E.ar + '").');
      } else {
        if (p.structure_ar) unknown(w, 'structure_ar', p.structure_ar, ea, 'ar');
        if (p.structure) unknown(w, 'structure', p.structure, ee, 'en');
      }
      const lang = p.dir === 'rtl' ? 'ar' : 'en', cr = LISTS.find(p.category, LISTS.categoryEntries(lang));
      if (cr.exact) {
        if (cr.exact.name !== p.category) warnings.push(w + '.category must be written exactly "' + cr.exact.name + '".');
        if (cr.exact.check && !acknowledged(cr.exact.name)) warnings.push(w + '.category "' + cr.exact.name + '" is a doubtful entry in the list (' + cr.exact.check + '). Pick another, or list it under Choices to confirm.');
      } else if (p.category) unknown(w, 'category', p.category, cr, 'name');
    });
  }
  if (!data.request_title_ar) warnings.push('request_title_ar is missing (the Arabic page would show the English title)');
  else if (LATIN.test(data.request_title_ar)) warnings.push('request_title_ar has English letters');
  ['missing', 'general', 'confirm'].forEach(function (k) {
    const e = (data.review || {})[k] || [], a = (data.review_ar || {})[k] || [];
    if (e.length !== a.length) warnings.push('review.' + k + ' has ' + e.length + ' items but review_ar.' + k + ' has ' + a.length);
    a.forEach(function (x) { if (LATIN.test(x)) warnings.push('review_ar.' + k + ' has English letters: ' + x); });
  });
}
if (errors.length) {
  console.error('ERROR: the data file has problems:');
  errors.forEach(function (e) { console.error(' - ' + e); });
  process.exit(1);
}

const candidates = [path.join(__dirname, 'draft-page.html'), path.join(__dirname, 'templates', 'draft-page.html'), path.join(__dirname, '..', 'templates', 'draft-page.html')];
const templatePath = candidates.find(function (p) { return fs.existsSync(p); });
if (!templatePath) { console.error('ERROR: draft-page.html not found (looked in templates/ and next to build.js).'); process.exit(1); }
const template = fs.readFileSync(templatePath, 'utf8');
if (template.indexOf('/*__DATA__*/null') === -1) { console.error('ERROR: the template has no data marker.'); process.exit(1); }

// draft_id lets the page name the file it saves (<draft_id>.edited.json). It is added to the page only, not to the source JSON.
const pageData = Object.assign({}, data, { draft_id: path.basename(input).replace(/\.json$/i, '') });
const json = JSON.stringify(pageData).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const out = input.replace(/\.json$/i, '') + '.html';
fs.writeFileSync(out, template.replace('/*__DATA__*/null', function () { return json; }));
if (warnings.length) { console.warn('WARNINGS (the page was built, but fix these in the JSON and run the build again):'); warnings.forEach(function (w) { console.warn(' - ' + w); }); }
if (notes.length) { console.log('NOTES (not blocking; the draft already lists them under Choices to confirm):'); notes.forEach(function (n) { console.log(' - ' + n); }); }
console.log('OK: created ' + out + '  (template used: ' + templatePath + ')');

// Open the finished page in the default browser (only when there are no warnings).
// Skip with: NO_OPEN=1 node build.js ...   or   node build.js ... --no-open
if (!warnings.length && !process.env.NO_OPEN && !process.argv.includes('--no-open')) {
  const abs = path.resolve(out);
  const opener = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', abs]]
               : process.platform === 'darwin' ? ['open', [abs]]
               : ['xdg-open', [abs]];
  try {
    const child = require('child_process').spawn(opener[0], opener[1], { detached: true, stdio: 'ignore' });
    child.on('error', function () { console.log('Could not open the browser automatically. Open this file by hand: ' + abs); });
    child.unref();
  } catch (e) { console.log('Could not open the browser automatically. Open this file by hand: ' + abs); }
}
