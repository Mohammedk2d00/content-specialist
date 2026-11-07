// Write feedback/report.md as text: repeated corrections per language, then every edit one by one.
const P = require('./patterns.js');
const draftsOf = P.draftsOf, langs = P.langs;
const joinRaw = require('./text.js').joinRaw;

function buildReport(pairs, posts, result, MIN, ALL) {
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
          const runs = (c.runs || []).map(function (r) { return (r.removed.length ? q(joinRaw(r.removed)) : '(nothing)') + ' \u2192 ' + (r.added.length ? q(joinRaw(r.added)) : '(deleted)'); });
          L.push('- ' + where + ': ' + runs.join('; '));
        }
      });
    });
    L.push('');
  });
  return { text: L.join('\n') + '\n', ruleCount: ruleCount };
}

module.exports = buildReport;
