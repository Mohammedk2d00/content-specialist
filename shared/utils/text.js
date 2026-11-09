// Text tests used by the build checks: tag stripping, Arabic letters, English letters outside official names.
const fs = require('fs');
const path = require('path');

const ARABIC = /[\u0600-\u06FF]/;
const strip = function (s) { return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&(?:[a-z]+|#\d+);/gi, ' '); };

function readAllowlist() {
  try {
    return fs.readFileSync(path.join(__dirname, '..', '..', 'rules', 'latin-allowlist.txt'), 'utf8').split(/\r?\n/)
      .map(function (l) { return l.trim(); }).filter(function (l) { return l && l[0] !== '#'; });
  } catch (e) { return []; }
}
const ALLOW = readAllowlist().sort(function (a, b) { return b.length - a.length; })
  .map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
const ALLOW_RE = new RegExp('(?:^|[^A-Za-z0-9])(?:' + ALLOW.concat(['Q[1-4]']).join('|') + ')(?![A-Za-z0-9])', 'gi');
// LATIN.test(x) is true only when x has English letters that are NOT an allowlisted official name
const LATIN = { test: function (x) { return /[A-Za-z]/.test(String(x || '').replace(ALLOW_RE, ' ')); } };

module.exports = { ARABIC: ARABIC, LATIN: LATIN, strip: strip };
