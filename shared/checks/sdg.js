// Sustainability-goal (SDG) checks. The agent suggests goals for a topic; the owner adds them with one click.
// These checks keep the suggestion honest: real goals, the university's exact names, goal numbers in words.
const AR = require('../utils/arabic.js');
const T = require('../utils/text.js');
const goals = require('../sdg-goals.js');

const MAX_GOALS = 3;
const bad = (list, f) => list.filter(function (x) { return !f(x); });

function checkGoalNumbers(s, w) {
  const ok = Array.isArray(s.goals) && s.goals.length > 0 && s.goals.length <= MAX_GOALS &&
    s.goals.every(function (n) { return Number.isInteger(n) && n >= 1 && n <= 17; }) && new Set(s.goals).size === s.goals.length;
  if (!ok) w('sdg.goals must be 1 to ' + MAX_GOALS + ' different whole numbers from 1 to 17, or use "sdg": null when no goal clearly fits.');
  return ok;
}

module.exports = function (ctx) {
  const d = ctx.data, w = ctx.warnings.push.bind(ctx.warnings), list = goals.load();
  if (!list) return;
  if (d.sdg === undefined) { w('sdg is missing. Add the sdg object (see "Sustainability goals" in GEMINI.md), or "sdg": null when no goal clearly fits.'); return; }
  if (d.sdg === null) return;
  const s = d.sdg;
  if (typeof s !== 'object' || !checkGoalNumbers(s, w)) return;
  ['why', 'why_ar'].forEach(function (k) {
    if (!Array.isArray(s[k]) || s[k].length !== s.goals.length || bad(s[k], function (x) { return typeof x === 'string' && x.trim(); }).length)
      w('sdg.' + k + ' needs one short reason per goal, in the same order as sdg.goals.');
  });
  if (Array.isArray(s.why_ar) && s.why_ar.some(function (x) { return T.LATIN.test(x); })) w('sdg.why_ar has English letters. It must be fully Arabic.');
  const ar = AR.stripMarks(T.strip(s.text_ar)), en = T.strip(s.text_en).toLowerCase();
  if (!ar.trim() || !en.trim()) { w('sdg.text_ar and sdg.text_en must both be written (the paragraph the owner adds to each post).'); return; }
  if (T.LATIN.test(ar)) w('sdg.text_ar has English letters. It must be fully Arabic.');
  if (/\d/.test(AR.westDigits(ar + en))) w('sdg.text_ar and sdg.text_en must write goal numbers in words (الهدف الرابع, the fourth), never digits.');
  s.goals.forEach(function (n) {
    const g = list[n - 1];
    if (!ar.includes('الهدف ' + g.ord_ar) || !ar.includes('(' + g.ar + ')')) w('sdg.text_ar must mention goal ' + n + ' as «الهدف ' + g.ord_ar + ' ... (' + g.ar + ')», with the exact name.');
    if (!en.includes(g.ord_en) || !en.includes('(' + g.en.toLowerCase() + ')')) w('sdg.text_en must mention goal ' + n + ' as "the ' + g.ord_en + ' ... (' + g.en + ')", with the exact name.');
  });
};
