// Find corrections that repeat across drafts (removed, added and replaced wording, paragraphs, tags, facts).
const T = require('./text.js');
const nrm = T.nrm, STOP = T.STOP, joinN = T.joinN, joinRaw = T.joinRaw;

const langs = ['English', 'Arabic'];
const draftsOf = function (list) { return Array.from(new Set(list.map(function (p) { return p.draft; }))); };

// ---------- patterns ----------
function candidates(textTokens, kind) {
  const out = new Set(), L = textTokens.length;
  if (L === 1 && textTokens[0].n.length >= 4 && !STOP.has(textTokens[0].n)) out.add(textTokens[0].n);
  const minN = kind === 'para' ? 3 : 2;
  for (let n = minN; n <= Math.min(6, L); n++) for (let s = 0; s + n <= L; s++) {
    const w = textTokens.slice(s, s + n);
    if (STOP.has(w[0].n) || STOP.has(w[n - 1].n)) continue;
    out.add(joinN(w));
  }
  return out;
}
function dedupe(list) {
  const kept = [];
  list.sort(function (a, b) { return b.phrase.split(' ').length - a.phrase.split(' ').length || b.count - a.count; });
  list.forEach(function (c) {
    if (!kept.some(function (k) { return (' ' + k.phrase + ' ').indexOf(' ' + c.phrase + ' ') > -1 && c.count <= k.count; })) kept.push(c);
  });
  return kept.sort(function (a, b) { return b.count - a.count || b.phrase.length - a.phrase.length; });
}

// MIN = how many different drafts a correction needs before it counts as a pattern
function findPatterns(posts, MIN) {
  const result = {};
  langs.forEach(function (lang) {
    const P = posts.filter(function (p) { return p.lang === lang; });
    const rawOf = {}, removedBy = {}, addedBy = {}, repBy = {};
    P.forEach(function (p) {
      p.changes.forEach(function (c) {
        (c.runs || []).forEach(function (r) {
          const kind = c.kind === 'paragraph_deleted' || c.kind === 'paragraph_added' ? 'para' : 'run';
          [[r.removed, removedBy], [r.added, addedBy]].forEach(function (pair) {
            const toks = pair[0], store = pair[1];
            if (!toks.length) return;
            candidates(toks, kind).forEach(function (ph) {
              (store[ph] = store[ph] || new Set()).add(p.draft);
              if (!rawOf[ph]) {
                const idx = joinN(toks).indexOf(ph);
                const words = ph.split(' ').length;
                const start = joinN(toks).slice(0, Math.max(idx, 0)).split(' ').filter(Boolean).length;
                rawOf[ph] = toks.slice(start, start + words).map(function (t) { return t.raw; }).join(' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
              }
            });
          });
          if (r.removed.length && r.added.length && r.removed.length <= 8 && r.added.length <= 8) {
            const key = joinN(r.removed) + ' => ' + joinN(r.added);
            (repBy[key] = repBy[key] || { from: joinRaw(r.removed), to: joinRaw(r.added), set: new Set() }).set.add(p.draft);
          }
        });
      });
    });
    const removed = dedupe(Object.keys(removedBy).map(function (ph) {
      const appeared = P.filter(function (p) { return p.origBody.indexOf(' ' + ph + ' ') > -1; });
      const gone = appeared.filter(function (p) { return p.editBody.indexOf(' ' + ph + ' ') < 0; });
      return { phrase: ph, raw: rawOf[ph], count: gone.length, appeared: appeared.length };
    }).filter(function (c) { return c.count >= MIN; }));
    const added = dedupe(Object.keys(addedBy).map(function (ph) {
      const fresh = P.filter(function (p) { return p.editBody.indexOf(' ' + ph + ' ') > -1 && p.origBody.indexOf(' ' + ph + ' ') < 0; });
      return { phrase: ph, raw: rawOf[ph], count: fresh.length };
    }).filter(function (c) { return c.count >= MIN; }));
    const replaced = Object.keys(repBy).map(function (k) { return { from: repBy[k].from, to: repBy[k].to, count: repBy[k].set.size }; })
      .filter(function (r) { return r.count >= MIN; }).sort(function (a, b) { return b.count - a.count; });

    // paragraph position stats
    const maxP = Math.max.apply(null, [0].concat(P.map(function (p) { return p.paragraphs; })));
    const positions = [];
    for (let k = 1; k <= maxP; k++) {
      const have = P.filter(function (p) { return p.paragraphs >= k; });
      const del = have.filter(function (p) { return p.changes.some(function (c) { return c.kind === 'paragraph_deleted' && c.para === k; }); });
      const rew = have.filter(function (p) { return p.changes.some(function (c) { return c.kind === 'paragraph_rewritten' && c.para === k; }); });
      if (have.length >= MIN && (del.length >= MIN || rew.length >= MIN)) positions.push({ k: k, total: have.length, del: del.length, rew: rew.length });
    }
    // tags
    const tagRem = {}, tagAdd = {};
    P.forEach(function (p) { p.changes.filter(function (c) { return c.kind === 'tags_changed'; }).forEach(function (c) {
      c.removed.forEach(function (t) { (tagRem[nrm(t)] = tagRem[nrm(t)] || { raw: t, set: new Set() }).set.add(p.draft); });
      c.added.forEach(function (t) { (tagAdd[nrm(t)] = tagAdd[nrm(t)] || { raw: t, set: new Set() }).set.add(p.draft); });
    }); });
    const rep = function (o) { return Object.keys(o).map(function (k) { return { raw: o[k].raw, count: o[k].set.size }; }).filter(function (x) { return x.count >= MIN; }).sort(function (a, b) { return b.count - a.count; }); };
    // owner-supplied specifics (numbers that were not in the original post or in the owner's request)
    const facts = [];
    P.forEach(function (p) { p.changes.forEach(function (c) { (c.runs || []).forEach(function (r) {
      const nums = r.added.map(function (t) { return t.n; }).filter(function (n) { return /\d/.test(n) && p.origBody.indexOf(' ' + n + ' ') < 0 && (' ' + p.sourceFacts + ' ').indexOf(' ' + n + ' ') < 0; });
      if (nums.length) facts.push({ draft: p.draft, field: c.field, added: joinRaw(r.added), removed: joinRaw(r.removed) });
    }); }); });
    const avg = function (k) { return P.length ? Math.round(P.reduce(function (s, p) { return s + p[k]; }, 0) / P.length) : 0; };
    result[lang] = {
      P: P, removed: removed, added: added, replaced: replaced, positions: positions, tagRem: rep(tagRem), tagAdd: rep(tagAdd), facts: facts,
      avgOrig: avg('origWords'), avgEdit: avg('editWords'),
      unchanged: P.filter(function (p) { return !p.changes.length; }).length,
      punct: P.filter(function (p) { return p.changes.some(function (c) { return c.kind === 'punctuation'; }); }).length,
      catChanges: P.reduce(function (a, p) { return a.concat(p.changes.filter(function (c) { return c.field === 'category' && c.kind !== 'punctuation'; }).map(function (c) { return { draft: p.draft, before: c.before, after: c.after }; })); }, [])
    };
  });
  return result;
}

module.exports = { findPatterns: findPatterns, langs: langs, draftsOf: draftsOf };
