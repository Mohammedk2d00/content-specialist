// Builds a one-time upgrade file (.cmd) for copies made BEFORE the patch updater existed. Those copies cannot read
// .uowapatch files, so this one file carries every app file plus the installer, and users just double-click it.
// Usage: node tools/make-upgrade.js   ->  patches/UOWA-upgrade-<app version>.cmd
// Users' own files are never included: drafts, feedback, style-guide.md, model.txt, engine.txt, settings.json, request.txt.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const fmt = require('../app/main/patch-format.js');

const ROOT = path.join(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'package.json'), 'utf8')).version;
if (!fs.existsSync(fmt.PUB_KEY_FILE)) { console.error('ERROR: run "node tools/make-patch.js base" first, so upgraded copies can check later patches.'); process.exit(1); }

const files = {};
for (const rel of fmt.listFiles(ROOT)) files[rel] = fs.readFileSync(path.join(ROOT, rel)).toString('base64');
const payload = zlib.gzipSync(JSON.stringify({ base: '0.0.0', to: version, files, delete: [] })).toString('base64');

// cmd.exe needs CRLF line endings in the batch part.
const template = fs.readFileSync(path.join(__dirname, 'upgrade-template.cmd'), 'utf8').replace(/\r?\n/g, '\r\n');
const out = path.join(ROOT, 'patches', 'UOWA-upgrade-' + version + '.cmd');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, template + '//PAYLOAD:' + payload + '\r\n');
console.log('Wrote ' + out + ' (' + Object.keys(files).length + ' files, ' + Math.ceil(fs.statSync(out).size / 1024) + ' KB). Send it once to users of older versions.');
