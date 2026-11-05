// Text helpers for comparing a draft with the owner's edited copy: cleaning, word tokens, paragraphs.
const AR = require('../utils/arabic.js');

const clean = function (s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
};
// comparison form of one word: no Arabic marks, no punctuation, lower case, Arabic-Indic digits to 0-9
const norm = function (w) {
  return AR.stripMarks(AR.westDigits(String(w).normalize('NFC')))
    .replace(/[.,;:!?()"'\u201C\u201D\u2018\u2019\u00AB\u00BB\u060C\u061B\u061F\u2026\-\u2013\u2014\/\\]/g, '')
    .toLowerCase();
};
const tokens = function (s) {
  return clean(s).split(' ').filter(Boolean).map(function (raw) { return { raw: raw, n: norm(raw) }; }).filter(function (t) { return t.n; });
};
const nrm = function (s) { return joinN(tokens(s)); };
const blocks = function (html) {
  const out = []; const re = /<(p|h2|h3|li)\b[^>]*>([\s\S]*?)<\/\1>/gi; let m;
  while ((m = re.exec(html || ''))) { const t = clean(m[2]); if (t) out.push(t); }
  if (!out.length && clean(html)) out.push(clean(html));
  return out;
};
const STOP = new Set(('the a an of in and to for on at by with as is was were that this its their from or be been has have had ' +
  'في من على الى إلى عن و التي الذي هذه هذا ذلك أن ان كما قد ثم كل بين').split(/\s+/));
// join the comparison form / the original spelling of a token list
const joinN = function (toks) { return toks.map(function (t) { return t.n; }).join(' '); };
const joinRaw = function (toks) { return toks.map(function (t) { return t.raw; }).join(' '); };

module.exports = { clean: clean, norm: norm, tokens: tokens, nrm: nrm, blocks: blocks, STOP: STOP, joinN: joinN, joinRaw: joinRaw };
