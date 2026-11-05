const { app, BrowserWindow, ipcMain, shell, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { exec, spawn } = require('node:child_process');
const lib = require('./lib.js');
const engine = require('./engine.js');

if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;
let current = null; // { cancel() } for whatever is running
// Portable mode: start.bat passes --workspace=<project folder>, and the app works directly in that folder.
const ARG_WS = ((process.argv.find(a => a.startsWith('--workspace=')) || '').slice('--workspace='.length)).replace(/^"|"$/g, '');
const WS = () => ARG_WS || path.join(app.getPath('documents'), 'UOWA Content Specialist');
const TEMPLATE = () => app.isPackaged ? path.join(process.resourcesPath, 'project-template') : path.join(__dirname, 'project-template');
const send = (ch, d) => { if (win && !win.isDestroyed()) win.webContents.send(ch, d); };

// ---- API key: stored per user outside the project folder, encrypted when the OS allows it.
const KEYFILE = () => path.join(app.getPath('userData'), 'apikey.bin');
function loadKey() {
  try {
    const s = fs.readFileSync(KEYFILE(), 'utf8');
    if (s.startsWith('enc1:')) return safeStorage.decryptString(Buffer.from(s.slice(5), 'base64'));
    if (s.startsWith('raw1:')) return s.slice(5);
  } catch (e) {}
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}
function keySource() {
  if (fs.existsSync(KEYFILE())) return 'saved';
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? 'env' : 'none';
}
function saveKey(k) {
  fs.mkdirSync(path.dirname(KEYFILE()), { recursive: true });
  const s = safeStorage.isEncryptionAvailable() ? 'enc1:' + safeStorage.encryptString(k).toString('base64') : 'raw1:' + k;
  fs.writeFileSync(KEYFILE(), s, { mode: 0o600 });
}
const settings = () => lib.readSettings(WS(), !!loadKey());
const engineOpts = (s, extra) => Object.assign({ apiKey: loadKey(), models: s.models, thinking: s.thinking, timeoutSec: s.timeoutSec, retries: s.retries, humanizer: s.humanizer }, extra || {});

// ---- Classic engine (Gemini CLI). Fixed prompts only; the request goes through request.txt (UTF-8).
const PROMPT_NEW = 'Read the file request.txt in this folder. It contains the owner request for a new post. Handle it exactly as GEMINI.md describes: write the draft JSON, run the build command, fix any warnings, then reply briefly.';
const PROMPT_LEARN = 'The owner says: learn from my edits. Follow the section Learning from the owner edits in GEMINI.md.';
function modelFlag(s) { const m = s.models[0]; return (m && /^[A-Za-z0-9._-]+$/.test(m)) ? ' -m ' + m : ''; }
const gemini = (p, s) => 'gemini' + modelFlag(s) + ' --yolo -p "' + p + '"';

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 860, minWidth: 760, minHeight: 600, autoHideMenuBar: true,
    title: 'UOWA Content Specialist',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function finish(kind, run, before, code, extra) {
  current = null;
  const created = lib.listDrafts(WS()).map(d => d.name).filter(n => !before.has(n));
  send('run:done', Object.assign({ kind, code, cancelled: !!run.cancelled, created }, extra || {}));
}

// A shell command run (Gemini CLI, npm, winget, build.js)
function startRun(kind, cmd, env) {
  if (current) return { ok: false, error: 'busy' };
  const before = new Set(lib.listDrafts(WS()).map(d => d.name));
  send('run:start', { kind });
  const run = lib.runCommand(cmd, WS(), c => send('run:log', c), env);
  run.cancel = () => lib.killTree(run);
  current = run;
  run.done.then(code => finish(kind, run, before, code));
  return { ok: true };
}

// An in-process run (the fast engine)
function startEngineRun(kind, fn) {
  if (current) return { ok: false, error: 'busy' };
  const before = new Set(lib.listDrafts(WS()).map(d => d.name));
  send('run:start', { kind });
  const ac = new AbortController();
  const run = { cancelled: false, cancel() { run.cancelled = true; ac.abort(); } };
  current = run;
  fn(ac.signal, s => send('run:log', s)).then(
    res => finish(kind, run, before, 0, { warnings: (res && res.warnings || []).length }),
    e => { send('run:log', '\n' + String(e && e.message || e) + '\n'); finish(kind, run, before, 1, { errorCode: (e && e.code) || 'other', url: (e && e.url) || '' }); }
  );
  return { ok: true };
}

const version = cmd => new Promise(res => exec(cmd, { timeout: 20000, windowsHide: true }, (err, out) => res(err ? null : String(out).trim().split(/\r?\n/)[0])));

ipcMain.handle('status', async () => {
  const s = settings();
  return { workspace: WS(), platform: process.platform, engine: s.engine, model: s.models[0], key: keySource(),
    node: await version('node --version'), gemini: await version('gemini --version') };
});
ipcMain.handle('drafts:list', () => lib.listDrafts(WS()));

ipcMain.handle('drafts:open', async (_e, name) => {
  if (!/^[A-Za-z0-9_.-]+$/.test(String(name))) return { ok: false };
  const html = path.join(WS(), 'drafts', name + '.html');
  const json = path.join(WS(), 'drafts', name + '.json');
  if (fs.existsSync(html)) { await shell.openPath(html); return { ok: true }; }
  if (!fs.existsSync(json)) return { ok: false };
  // page missing: rebuild it with Electron's own Node, then open it
  const r = startRun('rebuild', '"' + process.execPath + '" build.js "drafts/' + name + '.json"', { ELECTRON_RUN_AS_NODE: '1', NO_OPEN: '1' });
  if (r.ok && current) current.done.then(() => { if (fs.existsSync(html)) shell.openPath(html); });
  return r;
});

ipcMain.handle('post:create', (_e, text) => {
  const t = String(text || '').trim();
  if (!t) return { ok: false, error: 'empty' };
  const s = settings();
  if (s.engine === 'direct') {
    if (!loadKey()) return { ok: false, error: 'nokey' };
    return startEngineRun('new', async (signal, log) => {
      const res = await engine.createDraft(WS(), t, engineOpts(s, { signal, log }));
      log(res.warnings.length ? 'Draft created, but ' + res.warnings.length + ' warning(s) could not be fixed automatically. They are listed on the page under "Choices to confirm".\n' : 'Draft created.\n');
      if (fs.existsSync(res.html)) shell.openPath(res.html);
      return res;
    });
  }
  fs.writeFileSync(path.join(WS(), 'request.txt'), t + '\n', 'utf8');
  return startRun('new', gemini(PROMPT_NEW, s));
});

ipcMain.handle('learn', () => {
  const r = lib.importEdits(WS(), app.getPath('downloads'));
  send('run:log', 'Imported ' + r.moved.length + ' edited file(s) from Downloads.\n');
  const s = settings();
  if (s.engine === 'direct') {
    if (!loadKey()) return { ok: false, error: 'nokey' };
    return startEngineRun('learn', async (signal, log) => {
      const res = await engine.learnFromEdits(WS(), engineOpts(s, { signal, log }));
      log('\n' + res.summary + '\n');
      return res;
    });
  }
  return startRun('learn', gemini(PROMPT_LEARN, s));
});

ipcMain.handle('edits:import', () => lib.importEdits(WS(), app.getPath('downloads')));
ipcMain.handle('run:cancel', () => { if (current) current.cancel(); return { ok: true }; });
ipcMain.handle('folder:open', () => shell.openPath(WS()));
ipcMain.handle('extension:open', () => shell.openPath(path.join(WS(), 'extension')));
ipcMain.handle('install:gemini', () => startRun('install', 'npm install -g @google/gemini-cli'));
ipcMain.handle('install:node', () => {
  if (process.platform === 'win32') return startRun('install', 'winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements');
  shell.openExternal('https://nodejs.org');
  return { ok: true };
});

// Key + engine settings
ipcMain.handle('key:save', (_e, k) => {
  const key = String(k || '').trim();
  if (key.length < 20 || key.length > 300 || /\s/.test(key)) return { ok: false, error: 'badformat' };
  saveKey(key);
  return { ok: true, encrypted: safeStorage.isEncryptionAvailable() };
});
ipcMain.handle('key:clear', () => { try { fs.unlinkSync(KEYFILE()); } catch (e) {} return { ok: true, source: keySource() }; });
ipcMain.handle('key:test', async () => {
  const key = loadKey();
  if (!key) return { ok: false, code: 'nokey' };
  const s = settings();
  return engine.testKey(engineOpts(s, { timeoutSec: 60 }));
});
ipcMain.handle('engine:set', (_e, v) => {
  if (v !== 'direct' && v !== 'cli') return { ok: false };
  fs.writeFileSync(path.join(WS(), 'engine.txt'), v + '\n', 'utf8');
  return { ok: true };
});
ipcMain.handle('open:url', (_e, u) => { // only Google pages, for the "enable the API" link
  try { const x = new URL(u); if (x.protocol === 'https:' && /(^|\.)google\.com$/.test(x.hostname)) shell.openExternal(x.href); } catch (e) {}
  return { ok: true };
});

// Open a real terminal in the workspace running interactive gemini (Classic engine: Google sign-in and folder trust)
ipcMain.handle('terminal:open', () => {
  const o = { cwd: WS(), detached: true, stdio: 'ignore' };
  let child;
  if (process.platform === 'win32') child = spawn('cmd.exe', ['/c', 'start', 'Gemini', 'cmd', '/k', 'gemini'], o);
  else if (process.platform === 'darwin') child = spawn('open', ['-a', 'Terminal', WS()], o);
  else if (lib.hasCmd('konsole')) child = spawn('konsole', ['--workdir', WS(), '-e', 'gemini'], o);
  else if (lib.hasCmd('gnome-terminal')) child = spawn('gnome-terminal', ['--working-directory=' + WS(), '--', 'gemini'], o);
  else child = spawn('x-terminal-emulator', ['-e', 'gemini'], o);
  child.on('error', () => {});
  child.unref();
  return { ok: true };
});

app.whenReady().then(() => {
  if (!ARG_WS) lib.syncWorkspace(TEMPLATE(), WS(), app.getVersion());
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (current) current.cancel(); app.quit(); });
