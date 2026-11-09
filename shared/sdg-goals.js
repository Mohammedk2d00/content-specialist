// The 17 Sustainable Development Goals with the names the university uses (rules/sdg-goals.json).
// Used by the sdg check; loaded the same way as lists.js (the extension serves the file through its fs shim).
const fs = require('fs');
const path = require('path');
let DATA;
function load() {
  if (DATA !== undefined) return DATA;
  try { DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules', 'sdg-goals.json'), 'utf8')); } catch (e) { DATA = null; }
  return DATA;
}
module.exports = { load: load };
