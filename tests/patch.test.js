// Patch updater test (no Electron, no network). It exists because a bad updater can break every user's copy
// at once: it checks signatures, version rules, unsafe paths, user-data protection and rollback.
// Usage: node tests/patch.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const MAIN = path.join(__dirname, '..', 'app', 'main');
if (!fs.existsSync(path.join(MAIN, 'patcher.js'))) { console.log('SKIP patch updater not in this folder'); process.exit(0); }
const fmt = require(path.join(MAIN, 'patch-format.js'));
const patcher = require(path.join(MAIN, 'patcher.js'));

let bad = 0;
function test(name, fn) { try { fn(); console.log('PASS ' + name); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } }
function need(c, m) { if (!c) throw new Error(m); }
const pem = k => k.export(k.type === 'private' ? { type: 'pkcs8', format: 'pem' } : { type: 'spki', format: 'pem' });
const mine = crypto.generateKeyPairSync('ed25519'), other = crypto.generateKeyPairSync('ed25519');
const b64 = s => Buffer.from(s).toString('base64');
const body = { base: '1.0.1', to: '1.0.3', files: { 'app/a.txt': b64('new A'), 'app/sub/b.txt': b64('B') }, delete: ['old.txt'] };
const file = path.join(os.tmpdir(), 'uowa-test-' + process.pid + '.uowapatch');
fs.writeFileSync(file, fmt.pack(body, pem(mine.privateKey)));

function tmpRoot() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'uowa-patch-'));
  fs.mkdirSync(path.join(r, 'app')); fs.writeFileSync(path.join(r, 'app', 'a.txt'), 'old A'); fs.writeFileSync(path.join(r, 'old.txt'), 'x');
  return r;
}
const read = (r, f) => fs.readFileSync(path.join(r, f), 'utf8');

test('signed patch reads back', () => { need(patcher.readPatch(file, pem(mine.publicKey)).to === '1.0.3', 'wrong content'); });
test('patch signed with another key is refused', () => { let ok = false; try { patcher.readPatch(file, pem(other.publicKey)); } catch (e) { ok = true; } need(ok, 'accepted'); });
test('tampered patch is refused', () => {
  const o = JSON.parse(fs.readFileSync(file, 'utf8')); const d = Buffer.from(o.data, 'base64'); d[d.length - 5] ^= 1; o.data = d.toString('base64');
  let ok = false; try { fmt.unpack(JSON.stringify(o), pem(mine.publicKey)); } catch (e) { ok = true; } need(ok, 'accepted');
});
test('version rules (cumulative from base)', () => {
  need(patcher.canApply(body, '1.0.1') && patcher.canApply(body, '1.0.2'), 'should apply');
  need(!patcher.canApply(body, '1.0.3') && !patcher.canApply(body, '1.0.0'), 'should not apply');
});
test('apply writes, overwrites and deletes', () => {
  const r = tmpRoot(); patcher.applyPatch(r, body);
  need(read(r, 'app/a.txt') === 'new A' && read(r, 'app/sub/b.txt') === 'B' && !fs.existsSync(path.join(r, 'old.txt')), 'files wrong');
  need(read(r, '.patch-backup/app/a.txt') === 'old A', 'no backup');
});
['../evil.txt', 'C:/evil.txt', 'app\\evil.txt', 'drafts/x.json', 'style-guide.md', 'app/node_modules/x.js'].forEach(p => test('refuses unsafe path ' + p, () => {
  const r = tmpRoot(); let ok = false;
  try { patcher.applyPatch(r, { base: '1.0.1', to: '1.0.3', files: { 'app/a.txt': b64('Z'), [p]: b64('E') }, delete: [] }); } catch (e) { ok = true; }
  need(ok && read(r, 'app/a.txt') === 'old A', 'applied');
}));
test('failure rolls back earlier changes', () => {
  const r = tmpRoot(); fs.mkdirSync(path.join(r, 'app', 'dir.txt'));
  let ok = false; try { patcher.applyPatch(r, { base: '1.0.1', to: '1.0.3', files: { 'app/a.txt': b64('Z'), 'app/new.txt': b64('N'), 'app/dir.txt': b64('fails') }, delete: [] }); } catch (e) { ok = true; }
  need(ok && read(r, 'app/a.txt') === 'old A' && !fs.existsSync(path.join(r, 'app', 'new.txt')), 'not rolled back');
});
test('findPatch picks the newest applicable patch', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'uowa-dl-'));
  fs.copyFileSync(file, path.join(d, 'a.uowapatch'));
  fs.writeFileSync(path.join(d, 'b.uowapatch'), fmt.pack(Object.assign({}, body, { to: '1.0.4' }), pem(mine.privateKey)));
  fs.writeFileSync(path.join(d, 'c.uowapatch'), fmt.pack(Object.assign({}, body, { to: '1.0.9' }), pem(other.privateKey)));
  const f = patcher.findPatch(d, '1.0.2', pem(mine.publicKey));
  need(f && f.patch.to === '1.0.4', 'got ' + (f && f.patch.to));
});

fs.rmSync(file, { force: true });
process.exit(bad ? 1 : 0);
