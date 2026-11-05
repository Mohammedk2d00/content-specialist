// Usage: node learn.js [drafts-folder] [--min 2] [--all]
//
// Learns from the owner's edits.
// For every drafts/<name>.json that has an owner-edited copy drafts/<name>.edited*.json
// (the page saves it when the owner presses Approved), this script compares the two,
// finds corrections that REPEAT across drafts, and writes feedback/report.md.
// The agent then turns the repeated corrections into rules in style-guide.md.
//
//   --min N   a correction must appear in at least N different drafts to count as a pattern (default 2)
//   --all     also read posts the owner did not press Approved on (default: approved posts only)
//
// It never changes a draft and never touches style-guide.md. It is safe to run any number of times.
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const val = function (name, d) { const i = args.indexOf(name); return i > -1 && args[i + 1] ? args[i + 1] : d; };
const MIN = Math.max(1, parseInt(val('--min', '2'), 10) || 2);
const ALL = args.includes('--all');
const dirArg = args.find(function (a) { return !a.startsWith('--') && fs.existsSync(a) && fs.statSync(a).isDirectory(); });
const DIR = dirArg || path.join(__dirname, 'drafts');
const OUT_DIR = path.join(__dirname, 'feedback');

const FIELDS = ['category', 'title', 'sub_content', 'content_html', 'tags', 'image_suggestion', 'attachments'];

// ---------- text helpers ----------
const clean = function (s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
};
// comparison form of one word: no Arabic marks, no punctuation, lower case, Arabic-Indic digits to 0-9
const norm = function (w) {
  return String(w).normalize('NFC')
    .replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[.,;:!?()"'\u201C\u201D\u2018\u2019\u00AB\u00BB\u060C\u061B\u061F\u2026\-\u2013\u2014\/\\]/g, '')
    .toLowerCase();
};
const tokens = function (s) {
  return clean(s).split(' ').filter(Boolean).map(function (raw) { return { raw: raw, n: norm(raw) }; }).filter(function (t) { return t.n; });
};
const nrm = function (s) { return tokens(s).map(function (t) { return t.n; }).join(' '); };
const blocks = function (html) {
  const out = []; const re = /<(p|h2|h3|li)\b[^>]*>([\s\S]*?)<\/\1>/gi; let m;
  while ((m = re.exec(html || ''))) { const t = clean(m[2]); if (t) out.push(t); }
  if (!out.length && clean(html)) out.push(clean(html));
  return out;
};
const STOP = new Set(('the a an of in and to for on at by with as is was were that this its their from or be been has have had ' +
  'في من على الى إلى عن و التي الذي هذه هذا ذلك أن ان كما قد ثم كل بين').split(/\s+/));

function lcsPairs(a, b, eq) {
  const n = a.length, m = b.length, dp = [];
  for (let i = 0; i <= n; i++) dp.push(new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) { pairs.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return pairs;
}
// word-level changes between two texts: [{removed:[tok], added:[tok]}]
function wordChanges(textA, textB) {
  const A = tokens(textA), B = tokens(textB), out = []; let i = 0, j = 0;
  lcsPairs(A, B, function (x, y) { return x.n === y.n; }).concat([[A.length, B.length]]).forEach(function (p) {
    if (p[0] > i || p[1] > j) out.push({ removed: A.slice(i, p[0]), added: B.slice(j, p[1]) });
    i = p[0] + 1; j = p[1] + 1;
  });
  return out;
}
function similar(a, b) {
  const x = new Set(tokens(a).map(function (t) { return t.n; })), y = new Set(tokens(b).map(function (t) { return t.n; }));
  let inter = 0; x.forEach(function (t) { if (y.has(t)) inter++; });
  const uni = x.size + y.size - inter; return uni ? inter / uni : 0;
}

// ---------- compare one post ----------
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

// ---------- find the pairs ----------
if (!fs.existsSync(DIR)) { console.error('ERROR: folder not found: ' + DIR); process.exit(1); }
const files = fs.readdirSync(DIR);
const pairs = [];
files.filter(function (f) { return /\.json$/i.test(f) && !/\.edited/i.test(f); }).forEach(function (f) {
  const base = f.replace(/\.json$/i, '');
  const eds = files.filter(function (g) { return g.indexOf(base + '.edited') === 0 && /\.json$/i.test(g); })
    .map(function (g) { return { g: g, t: fs.statSync(path.join(DIR, g)).mtimeMs }; })
    .sort(function (a, b) { return b.t - a.t; });
  if (!eds.length) return;
  try {
    pairs.push({ id: base, orig: JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')), edit: JSON.parse(fs.readFileSync(path.join(DIR, eds[0].g), 'utf8')), editFile: eds[0].g });
  } catch (e) { console.warn('WARNING: skipped ' + base + ' (invalid JSON: ' + e.message + ')'); }
});
if (!pairs.length) {
  console.log('No edited drafts found in ' + DIR + '.');
  console.log('Open a draft page, edit it, go to Media and press Approved. The page saves <draft>.edited.json to your Downloads folder.');
  console.log('Move that file into the drafts folder next to the original, then run this again.');
  process.exit(0);
}

// ---------- compare everything ----------
const posts = []; // one entry per (draft, language)
pairs.forEach(function (pr) {
  (pr.orig.posts || []).forEach(function (op) {
    const ep = (pr.edit.posts || []).filter(function (x) { return x.dir === op.dir; })[0];
    if (!ep) return;
    const approvedAt = (pr.edit.owner_approved_at || {})[op.dir];
    const hasMarker = pr.edit.owner_approved_at !== undefined;
    if (!ALL && hasMarker && !approvedAt) return; // not approved: unfinished, skip
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
if (!posts.length) { console.log('Edited files found, but no approved posts in them. Press Approved on the page (or run with --all).'); process.exit(0); }

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
    out.add(w.map(function (t) { return t.n; }).join(' '));
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
              const idx = toks.map(function (t) { return t.n; }).join(' ').indexOf(ph);
              const words = ph.split(' ').length;
              const start = toks.map(function (t) { return t.n; }).join(' ').slice(0, Math.max(idx, 0)).split(' ').filter(Boolean).length;
              rawOf[ph] = toks.slice(start, start + words).map(function (t) { return t.raw; }).join(' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
            }
          });
        });
        if (r.removed.length && r.added.length && r.removed.length <= 8 && r.added.length <= 8) {
          const key = r.removed.map(function (t) { return t.n; }).join(' ') + ' => ' + r.added.map(function (t) { return t.n; }).join(' ');
          (repBy[key] = repBy[key] || { from: r.removed.map(function (t) { return t.raw; }).join(' '), to: r.added.map(function (t) { return t.raw; }).join(' '), set: new Set() }).set.add(p.draft);
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
    if (nums.length) facts.push({ draft: p.draft, field: c.field, added: r.added.map(function (t) { return t.raw; }).join(' '), removed: r.removed.map(function (t) { return t.raw; }).join(' ') });
  }); }); });
  const avg = function (k) { return P.length ? Math.round(P.reduce(function (s, p) { return s + p[k]; }, 0) / P.length) : 0; };
  result[lang] = {
    P: P, removed: removed, added: added, replaced: replaced, positions: positions, tagRem: rep(tagRem), tagAdd: rep(tagAdd), facts: facts,
    avgOrig: avg('origWords'), avgEdit: avg('editWords'),
    unchanged: P.filter(function (p) { return !p.changes.length; }).length,
    punct: P.filter(function (p) { return p.changes.some(function (c) { return c.kind === 'punctuation'; }); }).length,
    catChanges: P.reduce(function (a, p) { return a.concat(p.changes.filter(function (c) { return c.field === 'category' && c.kind !== 'punctuation'; }).map(function (c) { return { draft: p.draft, before: c.before, after: c.after }; })); }, []),
    titleChanges: P.reduce(function (a, p) { return a.concat(p.changes.filter(function (c) { return c.field === 'title' && c.kind !== 'punctuation'; }).map(function (c) { return { draft: p.draft, before: c.before, after: c.after }; })); }, [])
  };
});

// ---------- write the report ----------
const L = [];
const q = function (s) { return '\u201C' + s + '\u201D'; };
const today = new Date().toISOString().slice(0, 10);
L.push('# Owner edit report (' + today + ')', '');
L.push('Built by `learn.js` from ' + draftsOf(posts).length + ' edited draft(s), ' + posts.length + ' post(s)' + (ALL ? ' (including posts not approved)' : ' (approved posts only)') + '. A correction is called a pattern when it appears in at least ' + MIN + ' different drafts.');
L.push('Wording below is quoted from the owner\u2019s edits, in the post\u2019s own language.', '');
let ruleCount = 0;
langs.forEach(function (lang) {
  const r = result[lang]; if (!r.P.length) return;
  L.push('## ' + lang + ' posts (' + r.P.length + ' post(s) in ' + draftsOf(r.P).length + ' draft(s))', '');
  L.push('- Approved with no edits at all: ' + r.unchanged + ' of ' + r.P.length + (r.unchanged ? ' (what the agent got right is worth keeping)' : ''));
  L.push('- Average body length: ' + r.avgOrig + ' words written by the agent, ' + r.avgEdit + ' after the owner\u2019s edits' + (r.avgOrig && Math.abs(r.avgEdit - r.avgOrig) / r.avgOrig >= 0.1 ? ' (a change of ' + Math.round((r.avgEdit - r.avgOrig) / r.avgOrig * 100) + '%: consider adjusting the length target)' : ''));
  if (r.punct) L.push('- Punctuation-only edits in ' + r.punct + ' post(s). Check the one-off list below for the marks the owner changed.');
  L.push('');
  const sections = [];
  const sec = function (title, rows) { if (rows.length) { sections.push(title); rows.forEach(function (x) { sections.push(x); ruleCount++; }); sections.push(''); } };
  sec('### Repeated corrections: wording the owner removed', r.removed.map(function (c) { return '- Avoid ' + q(c.raw) + ' \u2014 removed in ' + c.count + ' of ' + c.appeared + ' drafts where it appeared'; }));
  sec('### Repeated corrections: replacements', r.replaced.map(function (c) { return '- Write ' + q(c.to) + ' instead of ' + q(c.from) + ' \u2014 ' + c.count + ' drafts'; }));
  sec('### Repeated corrections: structure', r.positions.map(function (c) {
    return '- Paragraph ' + c.k + ': ' + (c.del ? 'deleted in ' + c.del + ' of ' + c.total + ' posts' : '') + (c.del && c.rew ? ', ' : '') + (c.rew ? 'rewritten in ' + c.rew + ' of ' + c.total + ' posts' : '');
  }));
  sec('### Repeated corrections: wording the owner adds', r.added.map(function (c) { return '- Owner writes ' + q(c.raw) + ' \u2014 added in ' + c.count + ' drafts'; }));
  sec('### Repeated corrections: tags', r.tagRem.map(function (t) { return '- Tag removed: ' + q(t.raw) + ' \u2014 ' + t.count + ' drafts'; }).concat(r.tagAdd.map(function (t) { return '- Tag added: ' + q(t.raw) + ' \u2014 ' + t.count + ' drafts'; })));
  if (r.catChanges.length) { L.push('### Category changes (check the category rules in GEMINI.md)', ''); r.catChanges.forEach(function (c) { L.push('- ' + c.draft + ': ' + q(c.before) + ' \u2192 ' + q(c.after)); }); L.push(''); }
  if (!sections.length) L.push('No repeated corrections yet in ' + lang + '. Keep collecting edits; patterns need ' + MIN + ' or more drafts.', '');
  else sections.forEach(function (s) { L.push(s); });
  if (r.facts.length) {
    L.push('### Specifics the owner supplied (missing details, NOT style rules)', '');
    r.facts.forEach(function (f) { L.push('- ' + f.draft + ' / ' + f.field + ': added ' + q(f.added) + (f.removed ? ' (replacing ' + q(f.removed) + ')' : '')); });
    L.push('', 'These are facts the owner had and the agent did not. Do not turn them into style rules. If the same kind of detail is added every time, add it to the \u201CDetails you can add\u201D review note.', '');
  }
});
// one-offs, for context
L.push('## All edits, one by one (single edits are NOT rules)', '');
pairs.forEach(function (pr) {
  const mine = posts.filter(function (p) { return p.draft === pr.id; });
  if (!mine.length) return;
  L.push('### ' + pr.id + '  (' + pr.editFile + ')', '');
  mine.forEach(function (p) {
    if (!p.changes.length) { L.push('- ' + p.lang + ': approved with no edits'); return; }
    p.changes.forEach(function (c) {
      const where = p.lang + ' / ' + c.field + (c.para ? ' / paragraph ' + c.para + ' of ' + p.paragraphs : '');
      if (c.kind === 'tags_changed') L.push('- ' + where + ': removed ' + JSON.stringify(c.removed) + ', added ' + JSON.stringify(c.added));
      else if (c.kind === 'paragraph_deleted') L.push('- ' + where + ': DELETED ' + q(c.before));
      else if (c.kind === 'paragraph_added') L.push('- ' + p.lang + ' / content_html: ADDED ' + q(c.after));
      else if (c.kind === 'punctuation') L.push('- ' + where + ': punctuation only. Before ' + q(c.before) + ' After ' + q(c.after));
      else {
        const runs = (c.runs || []).map(function (r) { return (r.removed.length ? q(r.removed.map(function (t) { return t.raw; }).join(' ')) : '(nothing)') + ' \u2192 ' + (r.added.length ? q(r.added.map(function (t) { return t.raw; }).join(' ')) : '(deleted)'); });
        L.push('- ' + where + ': ' + runs.join('; '));
      }
    });
  });
  L.push('');
});
fs.mkdirSync(OUT_DIR, { recursive: true });
const outFile = path.join(OUT_DIR, 'report.md');
fs.writeFileSync(outFile, L.join('\n') + '\n');
console.log('OK: wrote ' + outFile);
console.log(draftsOf(posts).length + ' edited draft(s), ' + posts.length + ' post(s) compared, ' + ruleCount + ' repeated correction(s) found (threshold: ' + MIN + ' drafts).');
