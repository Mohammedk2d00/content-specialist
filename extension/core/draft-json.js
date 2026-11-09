// Small helpers for the draft JSON the model returns: parse it leniently, name it, date it.
function parseJson(text) {
  let t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a > 0 || (b >= 0 && b < t.length - 1)) t = t.slice(a, b + 1);
  const j = JSON.parse(t);
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('not an object');
  return j;
}

function slugify(s) { return String(s || 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'post'; }

const today = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };

// Same text shape build.js prints, so the model gets the repair instructions it was written for.
function problemsText(r) {
  const out = [];
  if (r.errors.length) out.push('ERROR: the data file has problems:', ...r.errors.map(e => ' - ' + e));
  if (r.warnings.length) out.push('WARNINGS (fix these in the JSON):', ...r.warnings.map(w => ' - ' + w));
  return out.join('\n');
}

module.exports = { parseJson, slugify, today, problemsText };
