// Per-post checks: one post per language, placeholders, allowed tags, tag count, Arabic/English letters.
const T = require('../utils/text.js');
const strip = T.strip, LATIN = T.LATIN, ARABIC = T.ARABIC;

module.exports = function (ctx) {
  const posts = ctx.posts, warnings = ctx.warnings;
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
};
