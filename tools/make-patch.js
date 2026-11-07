// Builds a small signed update file holding only the files changed since the base release,
// so users install updates without downloading the whole folder again.
//
//   node tools/make-patch.js base     Record this folder as the release users have. Run it when you send out a full zip.
//                                     (The first run also creates your signing key; see KEY below.)
//   node tools/make-patch.js 1.0.3    Set the app version to 1.0.3 and write patches/uowa-update-1.0.3.uowapatch.
//                                     Patches are cumulative from the base, so users can skip versions.
//
// Users' files are never in a patch: drafts, feedback, style-guide.md, model.txt, engine.txt, settings.json, request.txt.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fmt = require('../app/main/patch-format.js');

const ROOT = path.join(__dirname, '..');
// The private key stays outside the project folder, so it is never zipped or shipped. Back it up: without it,
// installed copies will refuse new patches until users get a full zip with the new public key.
const KEY = path.join(os.homedir(), '.uowa-patch-key.pem');
const BASE = path.join(ROOT, 'releases', 'base.json');
const PKG = path.join(ROOT, 'app', 'package.json');

const fail = msg => { console.error('ERROR: ' + msg); process.exit(1); };
const readPkg = () => JSON.parse(fs.readFileSync(PKG, 'utf8'));

function ensureKey() {
  if (!fs.existsSync(KEY)) {
    const { privateKey } = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(KEY, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    console.log('Created signing key: ' + KEY + '  (back it up)');
  }
  const pub = crypto.createPublicKey(fs.readFileSync(KEY, 'utf8')).export({ type: 'spki', format: 'pem' });
  fs.writeFileSync(fmt.PUB_KEY_FILE, pub);
}

function recordBase() {
  ensureKey();
  const version = readPkg().version;
  fs.mkdirSync(path.dirname(BASE), { recursive: true });
  const files = fmt.snapshot(ROOT);
  fs.writeFileSync(BASE, JSON.stringify({ version, files }, null, 1));
  console.log('Base release recorded: ' + version + ' (' + Object.keys(files).length + ' files). Send this folder as the full zip.');
}

function makePatch(to) {
  if (!/^\d+\.\d+\.\d+$/.test(to)) fail('version must look like 1.0.3');
  if (!fs.existsSync(BASE) || !fs.existsSync(KEY)) fail('run "node tools/make-patch.js base" first');
  const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
  if (fmt.cmpVersion(to, base.version) <= 0) fail('version must be higher than the base release ' + base.version);
  const pub = crypto.createPublicKey(fs.readFileSync(KEY, 'utf8')).export({ type: 'spki', format: 'pem' });
  if (fs.readFileSync(fmt.PUB_KEY_FILE, 'utf8') !== pub) fail('app/main/patch-key.pub does not match your key; users could not install this patch');

  const pkg = readPkg(); pkg.version = to;
  fs.writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n');

  const now = fmt.snapshot(ROOT);
  const changed = Object.keys(now).filter(r => now[r] !== base.files[r]);
  const removed = Object.keys(base.files).filter(r => !(r in now) && fmt.isSafeRel(r));
  const files = {};
  changed.forEach(r => { files[r] = fs.readFileSync(path.join(ROOT, r)).toString('base64'); });

  const out = path.join(ROOT, 'patches', 'uowa-update-' + to + '.uowapatch');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, fmt.pack({ base: base.version, to, files, delete: removed }, fs.readFileSync(KEY, 'utf8')));
  console.log('Changed: ' + (changed.join(', ') || 'none'));
  if (removed.length) console.log('Deleted: ' + removed.join(', '));
  console.log('Wrote ' + out + ' (' + Math.ceil(fs.statSync(out).size / 1024) + ' KB). Send this file to users.');
}

const arg = process.argv[2];
if (arg === 'base') recordBase();
else if (arg) makePatch(arg);
else fail('usage: node tools/make-patch.js base | <new version>');
