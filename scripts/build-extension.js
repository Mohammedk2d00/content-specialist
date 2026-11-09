// Usage: node scripts/build-extension.js   (or: npm run build)
// Makes the extension folder ready to load: bundles the side panel and review page into extension/dist/
// and copies the rule files (GEMINI.md, style guide, examples, lists, academic writing guides) into extension/rules/.
// Run it after changing any rule file or code; then press Reload on the browser's extensions page.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RULES = path.join(ROOT, 'rules');
const EXT = path.join(ROOT, 'extension');

// Published name in extension/rules/ -> source file under rules/.
function ruleFiles() {
  const map = {
    'GEMINI.md': 'GEMINI.md', 'style-guide.md': 'style-guide.md', 'sample-draft.json': 'sample-draft.json',
    'latin-allowlist.txt': 'latin-allowlist.txt', 'dashboard-lists.json': 'dashboard-lists.json',
    'academic-en.md': 'academic/en.md', 'academic-ar.md': 'academic/ar.md'
  };
  const examples = fs.readdirSync(path.join(RULES, 'examples')).filter(f => f.endsWith('.md')).sort();
  examples.forEach(f => { map[f] = 'examples/' + f; });
  return { map, examples };
}

function copyRules() {
  const out = path.join(EXT, 'rules');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const { map, examples } = ruleFiles();
  const files = Object.keys(map).filter(n => fs.existsSync(path.join(RULES, map[n])));
  files.forEach(n => fs.copyFileSync(path.join(RULES, map[n]), path.join(out, n)));
  fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({ files, examples: examples.filter(f => files.includes(f)) }, null, 2) + '\n');
  return files.length;
}

async function bundle() {
  const esbuild = require('esbuild');
  const dist = path.join(EXT, 'dist');
  fs.rmSync(dist, { recursive: true, force: true });
  await esbuild.build({
    entryPoints: { panel: path.join(EXT, 'panel', 'panel.js'), review: path.join(EXT, 'review', 'review.js') },
    outdir: dist, bundle: true, format: 'iife', platform: 'browser', target: 'chrome114', logLevel: 'warning',
    alias: { fs: path.join(EXT, 'shims', 'fs.js'), path: path.join(EXT, 'shims', 'path.js') },
    define: { __dirname: '"/"' }
  });
  // the review page uses the same page script and styles as build.js
  ['draft-page.js', 'draft-page.css'].forEach(f => fs.copyFileSync(path.join(ROOT, 'shared', 'templates', f), path.join(dist, f)));
}

if (require.main === module) {
  bundle().then(() => {
    console.log('OK: extension built (' + copyRules() + ' rule files). Load or reload the "extension" folder in the browser.');
  }).catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
}

module.exports = { ruleFiles };
