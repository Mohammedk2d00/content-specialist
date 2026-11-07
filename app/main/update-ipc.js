// Updates: a double-clicked .uowapatch, or one found in Downloads, is offered in the window; installing it restarts the app.
// Kept out of main.js so main.js stays small.
const { app, ipcMain, dialog, Notification } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const patcher = require('./patcher.js');
const { fetchLatestPatch } = require('./update-check.js');

const ROOT = path.join(__dirname, '..', '..'); // install folder: the one holding app/
const isPatchArg = a => String(a).toLowerCase().endsWith('.uowapatch');

// Read and check a patch file; returns { ok, file, to, current } or { ok:false, error }.
function inspect(file) {
  let patch;
  try { patch = patcher.readPatch(file); } catch (e) { return { ok: false, error: 'bad' }; }
  if (!patcher.canApply(patch, app.getVersion())) return { ok: false, error: 'old', to: patch.to };
  return { ok: true, file, to: patch.to, current: app.getVersion(), patch };
}
const forWindow = i => { const o = Object.assign({}, i); delete o.patch; return o; };

// Double-click support: point .uowapatch files at this copy of the app (per user, no admin rights).
// Skipped in the owner's dev folder (it has releases/), so patches open the user copy being tested.
function registerFileType() {
  if (process.platform !== 'win32' || app.isPackaged || fs.existsSync(path.join(ROOT, 'releases'))) return;
  const cmd = '"' + process.execPath + '" "' + path.join(ROOT, 'app') + '" --workspace="' + ROOT + '" "%1"';
  const K = 'HKCU\\Software\\Classes\\';
  [[K + '.uowapatch', 'UOWA.Patch'], [K + 'UOWA.Patch', 'UOWA Content Specialist update'], [K + 'UOWA.Patch\\shell\\open\\command', cmd],
    [K + 'UOWA.Patch\\DefaultIcon', path.join(ROOT, 'UOWA Content Specialist.exe') + ',0']]
    .forEach(([key, val]) => execFile('reg', ['add', key, '/ve', '/d', val, '/f'], { windowsHide: true }, () => {}));
}

// After startup: download the newest release patch, show it in the chat, and raise a Windows notification.
// Clicking the notification installs it straight away (auto: true), which is the "click to update" path.
async function checkOnline(getWin) {
  const file = await fetchLatestPatch(path.join(app.getPath('userData'), 'updates'));
  const i = file && inspect(file);
  const win = getWin();
  if (!i || !i.ok || !win) return;
  win.webContents.send('update:offer', forWindow(i));
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: 'UOWA Content Specialist', body: 'Update ' + i.to + ' is available. Click to install.' });
  n.on('click', () => {
    if (win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    win.webContents.send('update:offer', Object.assign(forWindow(i), { auto: true }));
  });
  n.show();
}

function registerUpdateIpc(getWin, isBusy) {
  registerFileType();
  if (process.platform === 'win32') app.setAppUserModelId('UOWA Content Specialist'); // Windows shows notifications only with an app id

  // A patch double-clicked while the app is already open arrives here.
  app.on('second-instance', (_e, argv) => {
    const win = getWin();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    const file = argv.find(isPatchArg);
    if (file) win.webContents.send('update:offer', forWindow(inspect(file)));
  });

  ipcMain.handle('update:find', () => {
    const file = process.argv.find(isPatchArg);
    if (file) return forWindow(inspect(file));
    const f = patcher.findPatch(app.getPath('downloads'), app.getVersion());
    if (!f) checkOnline(getWin); // nothing local: try GitHub in the background
    return f ? { ok: true, file: f.file, to: f.patch.to, current: app.getVersion() } : null;
  });

  ipcMain.handle('update:pick', async () => {
    const r = await dialog.showOpenDialog(getWin(), { filters: [{ name: 'UOWA update', extensions: ['uowapatch'] }], properties: ['openFile'] });
    return r.canceled || !r.filePaths[0] ? null : forWindow(inspect(r.filePaths[0]));
  });

  ipcMain.handle('update:apply', (_e, file) => {
    // shortcut: only the portable folder layout is patchable; an installer build would need its own updater.
    if (app.isPackaged) return { ok: false, error: 'packaged' };
    if (isBusy()) return { ok: false, error: 'busy' };
    if (!isPatchArg(file)) return { ok: false, error: 'bad' };
    const i = inspect(String(file));
    if (!i.ok) return i;
    try { patcher.applyPatch(ROOT, i.patch); } catch (e) { return { ok: false, error: 'failed', detail: String(e.message || e) }; }
    // Restart without the patch path, or the new window would offer the same patch again.
    const args = process.argv.slice(1).filter(a => !isPatchArg(a));
    setTimeout(() => { app.relaunch({ args }); app.exit(0); }, 1500); // let the window show "restarting" first
    return { ok: true, to: i.to };
  });
}

module.exports = { registerUpdateIpc };
