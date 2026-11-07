// Installs a .uowapatch into the install folder. It backs up every file it touches and rolls back on any error,
// so a broken patch never leaves the app half-updated. Pure Node, so tests can drive it without Electron.
const fs = require('node:fs');
const path = require('node:path');
const fmt = require('./patch-format.js');

function readPatch(file, publicKeyPem) {
  return fmt.unpack(fs.readFileSync(file, 'utf8'), publicKeyPem || fs.readFileSync(fmt.PUB_KEY_FILE, 'utf8'));
}

// Patches are cumulative from a base release, so any installed version from base up to (not including) "to" can take it.
function canApply(patch, current) { return fmt.cmpVersion(current, patch.base) >= 0 && fmt.cmpVersion(patch.to, current) > 0; }

// Newest valid, applicable patch in a folder (normally Downloads), or null. Unsigned or damaged files are ignored.
function findPatch(dir, current, publicKeyPem) {
  let best = null;
  let names = [];
  try { names = fs.readdirSync(dir).filter(n => n.toLowerCase().endsWith('.uowapatch')); } catch (e) { return null; }
  for (const n of names) {
    try {
      const patch = readPatch(path.join(dir, n), publicKeyPem);
      if (canApply(patch, current) && (!best || fmt.cmpVersion(patch.to, best.patch.to) > 0)) best = { file: path.join(dir, n), patch };
    } catch (e) { /* not ours or damaged: skip */ }
  }
  return best;
}

// The installer hides most top-level files to keep the folder tidy. Windows refuses to overwrite a hidden file,
// so unhide it for the write and restore its old state after. Returns whether it was hidden. No-op off Windows.
// attrib prints the attribute letters, then the path: "A    H        C:\\app\\build.js".
const hiddenInAttrib = (out, file) => /H/.test(out.slice(0, Math.max(0, out.toLowerCase().indexOf(file.toLowerCase()))));
function setHidden(file, on) {
  if (process.platform !== 'win32') return false;
  const cp = require('node:child_process');
  try {
    const out = cp.execFileSync('attrib', [file], { encoding: 'utf8', windowsHide: true });
    const was = hiddenInAttrib(out, file);
    if (was !== on) cp.execFileSync('attrib', [on ? '+h' : '-h', file], { windowsHide: true });
    return was;
  } catch (e) { return false; } // missing file: nothing to restore
}
const isTopFile = rel => !rel.includes('/');

function applyPatch(root, patch) {
  const all = Object.keys(patch.files).concat(patch.delete);
  const bad = all.find(r => !fmt.isSafeRel(r));
  if (bad) throw new Error('unsafe path in patch: ' + bad);
  const backup = path.join(root, '.patch-backup');
  fs.rmSync(backup, { recursive: true, force: true }); // keep only the last update's backup
  fs.mkdirSync(backup, { recursive: true });
  setHidden(backup, true);
  const touched = [];
  try {
    for (const rel of all) {
      const dest = path.join(root, rel);
      const existed = fs.existsSync(dest);
      if (existed) { fs.mkdirSync(path.dirname(path.join(backup, rel)), { recursive: true }); fs.copyFileSync(dest, path.join(backup, rel)); }
      const hidden = isTopFile(rel) && existed && setHidden(dest, false);
      touched.push({ rel, existed, hidden });
      if (rel in patch.files) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, Buffer.from(patch.files[rel], 'base64')); }
      else if (existed) fs.rmSync(dest);
      if (hidden && rel in patch.files) setHidden(dest, true);
    }
  } catch (e) { rollback(root, backup, touched); throw e; }
  return touched.length;
}

// Put back what was there before, newest change first.
function rollback(root, backup, touched) {
  for (const t of touched.reverse()) {
    const dest = path.join(root, t.rel);
    try {
      if (t.hidden) setHidden(dest, false);
      if (t.existed) fs.copyFileSync(path.join(backup, t.rel), dest); else fs.rmSync(dest, { force: true });
      if (t.hidden) setHidden(dest, true);
    } catch (e) { /* best effort */ }
  }
}

module.exports = { readPatch, canApply, findPatch, applyPatch, hiddenInAttrib };
