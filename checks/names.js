// Structure and Category names must be real dashboard names (dashboard-lists.json).

module.exports = function (ctx) {
  const data = ctx.data, posts = ctx.posts, warnings = ctx.warnings, notes = ctx.notes;
  // ---- Structure and Category names must be real dashboard names (dashboard-lists.json, searched with lookup.js) ----
  let LISTS = null; try { LISTS = require('../lists.js'); if (!LISTS.load()) LISTS = null; } catch (e) { LISTS = null; }
  if (LISTS) {
    const sEn = LISTS.structureEntries('en'), sAr = LISTS.structureEntries('ar');
    const acknowledged = function (v) { const hay = JSON.stringify([(data.review || {}).confirm || [], (data.review_ar || {}).confirm || []]).toLowerCase(); return hay.indexOf(String(v).toLowerCase()) > -1; };
    const unknown = function (w, what, value, r, field) {
      if (r.near.length) { warnings.push(w + '.' + what + ' "' + value + '" is not a dashboard name. Closest: ' + r.near.map(function (x) { return '"' + x[field] + '"'; }).join(', ') + '. Use one of them exactly, or search with: node lookup.js <word>'); return; }
      const msg = w + '.' + what + ' "' + value + '" is not in dashboard-lists.json (the list is missing about 8 Structures and 10 Categories).';
      if (acknowledged(value)) notes.push(msg + ' It is listed under Choices to confirm.');
      else warnings.push(msg + ' Search with node lookup.js first. If the owner really named it, keep it and add it to review.confirm and review_ar.confirm; otherwise use a listed name.');
    };
    posts.forEach(function (p, i) {
      const w = 'posts[' + i + ']';
      const ea = LISTS.find(p.structure_ar, sAr), ee = LISTS.find(p.structure, sEn), E = ea.exact || ee.exact;
      if (E) {
        if (E.ar && E.ar !== p.structure_ar) warnings.push(w + '.structure_ar must be written exactly "' + E.ar + '" (the extension types it into the dashboard).');
        if (E.en && E.en !== p.structure) warnings.push(w + '.structure must be written exactly "' + E.en + '" (the dashboard English name for "' + E.ar + '").');
      } else {
        if (p.structure_ar) unknown(w, 'structure_ar', p.structure_ar, ea, 'ar');
        if (p.structure) unknown(w, 'structure', p.structure, ee, 'en');
      }
      const lang = p.dir === 'rtl' ? 'ar' : 'en', cr = LISTS.find(p.category, LISTS.categoryEntries(lang));
      if (cr.exact) {
        if (cr.exact.name !== p.category) warnings.push(w + '.category must be written exactly "' + cr.exact.name + '".');
        if (cr.exact.check && !acknowledged(cr.exact.name)) warnings.push(w + '.category "' + cr.exact.name + '" is a doubtful entry in the list (' + cr.exact.check + '). Pick another, or list it under Choices to confirm.');
      } else if (p.category) unknown(w, 'category', p.category, cr, 'name');
    });
  }
};
