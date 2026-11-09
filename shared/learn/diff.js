// Word and paragraph alignment (longest common subsequence) between two texts.
const tokens = require('./text.js').tokens;

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

module.exports = { lcsPairs: lcsPairs, wordChanges: wordChanges, similar: similar };
