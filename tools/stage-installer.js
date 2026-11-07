// Copies every shipped app file (same list the patcher uses, never user data) into installer/stage,
// so Inno Setup packs exactly what an update would ship and nothing else.
// Usage: node tools/stage-installer.js
const fs = require('fs');
const path = require('path');
const fmt = require('../app/main/patch-format.js');

const ROOT = path.join(__dirname, '..');
const STAGE = path.join(ROOT, 'installer', 'stage');
fs.rmSync(STAGE, { recursive: true, force: true });
// Dev-only files stay out. style-guide.md and model.txt are user data (never in patches) but a fresh install needs the defaults.
const DEV_ONLY = new Set(['.github', 'installer', 'tests', 'CLAUDE.md', 'project_rules.md', 'setup.sh', 'start.sh']);
const DEFAULTS = ['style-guide.md', 'model.txt'];
const files = fmt.listFiles(ROOT).filter(rel => !DEV_ONLY.has(rel.split('/')[0])).concat(DEFAULTS);
for (const rel of files) {
  fs.mkdirSync(path.dirname(path.join(STAGE, rel)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, rel), path.join(STAGE, rel));
}
console.log('Staged ' + files.length + ' files in installer/stage');
