// Patch file format, shared by the app (installs patches) and tools/make-patch.js (builds them).
// A patch is ONE signed file holding only the changed files, so users never re-download the whole folder.
// Pure Node (no Electron), so it can be tested on its own.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { KEEP } = require('./lib.js');

const PUB_KEY_FILE = path.join(__dirname, 'patch-key.pub');
// Top-level names a patch never ships or touches: user data (KEEP) and local-only folders.
const SKIP_TOP = new Set([...KEEP, 'releases', 'patches', '.patch-backup', '.workspace-version', '.git']);

function isSkipped(rel) { return SKIP_TOP.has(rel.split('/')[0]) || rel.split('/').includes('node_modules'); }

// Patch paths come from a downloaded file: refuse anything that could leave the install folder or touch user data.
function isSafeRel(rel) {
  return typeof rel === 'string' && rel.length > 0 && !/[\\:]/.test(rel) && !rel.startsWith('/') &&
    !rel.split('/').some(p => p === '' || p === '.' || p === '..') && !isSkipped(rel);
}

// Every shipped file under root, as forward-slash relative paths. Junctions (the drafts link) are not followed.
function listFiles(root, dir = '') {
  let out = [];
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir ? dir + '/' + e.name : e.name;
    if (isSkipped(rel) || e.isSymbolicLink()) continue;
    if (e.isDirectory()) out = out.concat(listFiles(root, rel));
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

function snapshot(root) {
  const m = {};
  for (const rel of listFiles(root)) m[rel] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
  return m;
}

// body = { base, to, files: { rel: base64 }, delete: [rel] }. Signed with Ed25519 so only the owner's patches install.
function pack(body, privateKeyPem) {
  const data = zlib.gzipSync(Buffer.from(JSON.stringify(body)));
  return JSON.stringify({ format: 1, sig: crypto.sign(null, data, privateKeyPem).toString('base64'), data: data.toString('base64') });
}

function unpack(text, publicKeyPem) {
  const o = JSON.parse(text);
  if (o.format !== 1) throw new Error('unknown patch format');
  const data = Buffer.from(String(o.data), 'base64');
  if (!crypto.verify(null, data, publicKeyPem, Buffer.from(String(o.sig), 'base64'))) throw new Error('bad signature');
  const body = JSON.parse(zlib.gunzipSync(data).toString('utf8'));
  if (!body.files || !Array.isArray(body.delete) || !body.to || !body.base) throw new Error('incomplete patch');
  return body;
}

// Compare "1.2.3" style versions: negative, 0 or positive.
function cmpVersion(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
}

module.exports = { PUB_KEY_FILE, isSkipped, isSafeRel, listFiles, snapshot, pack, unpack, cmpVersion };
