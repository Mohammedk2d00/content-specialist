// Style-guide checks: hype, exclamation marks, emoji, title length, body length, same numbers in both languages.
const AR = require('../utils/arabic.js');
const strip = require('../utils/text.js').strip;
const westDigits = AR.westDigits;

module.exports = function (ctx) {
  const posts = ctx.posts, warnings = ctx.warnings;
  // ---- style checks (from style-guide.md) ----
  const HYPE_EN = /\b(exceptional|outstanding|distinguished|remarkable|stimulating|unparalleled|world-class|groundbreaking|extraordinary)\b/i;
  const HYPE_AR = /(استثنائي|منقطع النظير|لا مثيل|الأفضل على الإطلاق)/;
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
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
};
