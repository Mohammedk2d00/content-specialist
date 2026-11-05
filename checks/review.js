// The Arabic request title and the review lists must match the English ones and be fully Arabic.
const LATIN = require('../utils/text.js').LATIN;

module.exports = function (ctx) {
  const data = ctx.data, warnings = ctx.warnings;
  if (!data.request_title_ar) warnings.push('request_title_ar is missing (the Arabic page would show the English title)');
  else if (LATIN.test(data.request_title_ar)) warnings.push('request_title_ar has English letters');
  ['missing', 'general', 'confirm'].forEach(function (k) {
    const e = (data.review || {})[k] || [], a = (data.review_ar || {})[k] || [];
    if (e.length !== a.length) warnings.push('review.' + k + ' has ' + e.length + ' items but review_ar.' + k + ' has ' + a.length);
    a.forEach(function (x) { if (LATIN.test(x)) warnings.push('review_ar.' + k + ' has English letters: ' + x); });
  });
};
