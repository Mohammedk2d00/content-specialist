// Academic-register checks: first or second person, contractions, questions, informal or dialect words,
// and American spellings in English posts. They exist because the writer drifts into a chatty or
// promotional voice; each warning goes back to the model, which fixes it before the owner sees the draft.
const AR = require('../utils/arabic.js');
const strip = require('../utils/text.js').strip;

const EN_PERSON = /\b(we|our|ours|you|your|yours)\b/i;
const EN_US = /\bus\b/; // lowercase only, so the country "US" is not flagged
const EN_CONTRACTION = /\b[a-z]+(?:n['’]t|['’](?:re|ve|ll|m|d))\b/i;
const EN_INFORMAL = /\b(amazing|awesome|fantastic|wonderful|huge|stuff|kids|guys|super|fun|great success|a lot of|lots of)\b/i;
const EN_AMERICAN = /\b(organiz\w*|recogniz\w*|specializ\w*|emphasiz\w*|utiliz\w*|analyz\w*|honor(?:s|ed|ing|able|ary)?|centers?|color\w*|behavior\w*|defense|catalog(?:s|ed)?)\b/i;

// Arabic words must stand alone (an optional و or ف in front is allowed).
const AL = '[ء-ي]';
const arWords = list => new RegExp('(?<!' + AL + ')(?:[وف])?(' + list.join('|') + ')(?!' + AL + ')');
const AR_PERSON = arWords(['نحن', 'لدينا', 'عندنا', 'ندعو', 'ندعوكم', 'نرحب', 'أنتم', 'انتم', 'إليكم', 'اليكم', 'لكم', 'معكم', 'جامعتنا', 'كليتنا', 'طلبتنا']);
const AR_INFORMAL = arWords(['رائع', 'رائعة', 'مذهل', 'مذهلة', 'مميز', 'مميزة', 'المميز', 'المميزة', 'هسه', 'شلون', 'اكو', 'ماكو', 'هواية', 'كلش', 'شنو', 'ليش']);

// Official names keep their own spelling ("Information Technology Center", "Honorary Board").
let officialRe;
function withoutOfficialNames(text) {
  if (officialRe === undefined) {
    let names = [];
    try {
      const d = require('../lists.js').load();
      if (d) names = d.structures.map(s => s.en).concat((d.categories.en || []).map(c => c.name));
    } catch (e) { names = []; }
    names = names.filter(n => n && EN_AMERICAN.test(n)).sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    officialRe = names.length ? new RegExp(names.join('|'), 'gi') : null;
  }
  return officialRe ? text.replace(officialRe, ' ') : text;
}

function checkEnglish(w, body, warn) {
  const person = body.match(EN_PERSON) || body.match(EN_US);
  if (person) warn(w + ' uses "' + person[0] + '". Write in the third person ("the college", "the university"), never "we" or "you".');
  const c = body.match(EN_CONTRACTION);
  if (c) warn(w + ' uses the contraction "' + c[0] + '". Write it in full (do not, it is).');
  if (/\?/.test(body)) warn(w + ' has a question mark. Academic posts state facts; rewrite the question as a statement.');
  const inf = body.match(EN_INFORMAL);
  if (inf) warn(w + ' uses informal wording "' + inf[0] + '". Use measured academic wording.');
  const am = withoutOfficialNames(body).match(EN_AMERICAN);
  if (am) warn(w + ' uses American spelling "' + am[0] + '". Use British spelling (organised, centre, honour, colour, behaviour, defence, analyse, catalogue).');
}

function checkArabic(w, body, warn) {
  const t = AR.stripMarks(body);
  const person = t.match(AR_PERSON);
  if (person) warn(w + ' uses "' + person[1] + '". Write in the third person (\"الكلية\", \"الجامعة\"), never first or second person.');
  if (/؟/.test(t)) warn(w + ' has an Arabic question mark (؟). Academic posts state facts; rewrite the question as a statement.');
  const inf = t.match(AR_INFORMAL);
  if (inf) warn(w + ' uses informal or dialect wording "' + inf[1] + '". Use measured academic Modern Standard Arabic.');
}

module.exports = function (ctx) {
  ctx.posts.forEach(function (p, i) {
    const body = strip([p.title, p.sub_content, p.content_html].join(' '));
    const warn = m => ctx.warnings.push(m);
    if (p.dir === 'rtl') checkArabic('posts[' + i + ']', body, warn);
    else checkEnglish('posts[' + i + ']', body, warn);
  });
};
