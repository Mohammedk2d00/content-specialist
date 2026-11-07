// Structure checks. Any ERROR here stops the build: the page cannot be made from this data.
module.exports = function (ctx) {
  const posts = ctx.posts, errors = ctx.errors;
  if (!posts.length) errors.push('"posts" must be a non-empty array');
  posts.forEach(function (p, i) {
    const w = 'posts[' + i + ']';
    if (!p || typeof p !== 'object') { errors.push(w + ' must be an object'); return; }
    ['language', 'dir', 'structure', 'category', 'title'].forEach(function (k) { if (!p[k]) errors.push(w + '.' + k + ' is missing'); });
    if (p.dir && p.dir !== 'rtl' && p.dir !== 'ltr') errors.push(w + '.dir must be "rtl" or "ltr"');
    if (!p.content_html && !p.sub_content && !(p.tags && p.tags.length)) errors.push(w + ' has no content_html, sub_content or tags');
    if (p.tags && !Array.isArray(p.tags)) errors.push(w + '.tags must be an array');
  });
};
