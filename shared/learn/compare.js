// Compare each original post with the owner's edited copy and list every change.
const T = require('./text.js');
const D = require('./diff.js');
const clean = T.clean, tokens = T.tokens, nrm = T.nrm, blocks = T.blocks;
const lcsPairs = D.lcsPairs, wordChanges = D.wordChanges, similar = D.similar;

function comparePost(orig, edit) {
  const changes = [];
  ['title', 'category', 'sub_content', 'image_suggestion', 'attachments'].forEach(function (k) {
    const a = clean(orig[k]), b = clean(edit[k]);
    if (a === b) return;
    if (nrm(a) === nrm(b)) changes.push({ field: k, kind: 'punctuation', before: a, after: b });
    else changes.push({ field: k, kind: 'text_changed', before: a, after: b, runs: wordChanges(a, b) });
  });
  const ta = (orig.tags || []).map(String), tb = (edit.tags || []).map(String);
  const rem = ta.filter(function (t) { return !tb.some(function (u) { return nrm(u) === nrm(t); }); });
  const add = tb.filter(function (t) { return !ta.some(function (u) { return nrm(u) === nrm(t); }); });
  if (rem.length || add.length) changes.push({ field: 'tags', kind: 'tags_changed', removed: rem, added: add });

  const A = blocks(orig.content_html), B = blocks(edit.content_html);
  const anchors = lcsPairs(A, B, function (x, y) { return nrm(x) === nrm(y); });
  let i = 0, j = 0;
  anchors.concat([[A.length, B.length]]).forEach(function (p) {
    const gapA = A.slice(i, p[0]), gapB = B.slice(j, p[1]);
    // match each new paragraph to the most similar old paragraph in the gap (keeping the order); the rest are deletions/additions
    const usedB = {}, matchOfA = {}; let from = 0;
    gapB.forEach(function (tb, y) {
      let best = -1, bestSim = 0.4;
      for (let x = from; x < gapA.length; x++) { const sm = similar(gapA[x], tb); if (sm >= bestSim) { best = x; bestSim = sm; } }
      if (best > -1) { matchOfA[best] = y; usedB[y] = 1; from = best + 1; }
    });
    gapA.forEach(function (ta, x) {
      const para = i + x + 1;
      if (matchOfA[x] !== undefined) {
        const tb = gapB[matchOfA[x]];
        changes.push({ field: 'content_html', kind: 'paragraph_rewritten', para: para, before: ta, after: tb, runs: wordChanges(ta, tb) });
      } else changes.push({ field: 'content_html', kind: 'paragraph_deleted', para: para, before: ta, runs: [{ removed: tokens(ta), added: [] }] });
    });
    gapB.forEach(function (t, x) { if (!usedB[x]) changes.push({ field: 'content_html', kind: 'paragraph_added', after: t, runs: [{ removed: [], added: tokens(t) }] }); });
    if (p[0] < A.length && A[p[0]] !== B[p[1]]) changes.push({ field: 'content_html', kind: 'punctuation', para: p[0] + 1, before: A[p[0]], after: B[p[1]] });
    i = p[0] + 1; j = p[1] + 1;
  });
  return { changes: changes, paragraphs: A.length };
}

// The review page's Add-to-post button inserts the suggested SDG text; that is not a correction, so leave it out.
function withoutSdg(post, sdg) {
  const text = post && sdg && (post.dir === 'rtl' ? sdg.text_ar : sdg.text_en);
  if (!text || String(post.content_html || '').indexOf(text) < 0) return post;
  return Object.assign({}, post, { content_html: post.content_html.replace(' ' + text, '').replace(text, '') });
}

// One entry per (draft, language). Posts the owner did not approve are skipped unless all is true.
function comparePairs(pairs, all) {
  const posts = []; // one entry per (draft, language)
  pairs.forEach(function (pr) {
    (pr.orig.posts || []).forEach(function (op) {
      const ep = withoutSdg((pr.edit.posts || []).filter(function (x) { return x.dir === op.dir; })[0], pr.edit.sdg || pr.orig.sdg);
      if (!ep) return;
      const approvedAt = (pr.edit.owner_approved_at || {})[op.dir];
      const hasMarker = pr.edit.owner_approved_at !== undefined;
      if (!all && hasMarker && !approvedAt) return; // not approved: unfinished, skip
      const r = comparePost(op, ep);
      const body = function (p) { return nrm([p.title, p.sub_content, p.content_html].join(' ')); };
      posts.push({
        draft: pr.id, lang: op.dir === 'rtl' ? 'Arabic' : 'English', dir: op.dir, changes: r.changes, paragraphs: r.paragraphs,
        origBody: ' ' + body(op) + ' ', editBody: ' ' + body(ep) + ' ',
        origWords: tokens(clean(op.content_html)).length, editWords: tokens(clean(ep.content_html)).length,
        origText: clean([op.title, op.sub_content, op.content_html].join(' ')),
        sourceFacts: nrm((pr.orig.source_facts || []).concat([pr.orig.request_title || '', pr.orig.request_title_ar || '']).join(' '))
      });
    });
  });
  return posts;
}

module.exports = { comparePost: comparePost, comparePairs: comparePairs, withoutSdg: withoutSdg };
