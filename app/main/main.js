const { app, BrowserWindow, ipcMain, shell, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { exec, spawn } = require('node:child_process');
const lib = require('./lib.js');
const engine = require('./engine.js');
const keys = require('./key-store.js');
const { createRunner } = require('./runner.js');
const { registerUpdateIpc } = require('./update-ipc.js');

if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;
// Portable mode: start.bat passes --workspace=<project folder>, and the app works directly in that folder.
const ARG_WS = ((process.argv.find(a => a.startsWith('--workspace=')) || '').slice('--workspace='.length)).replace(/^"|"$/g, '');
const WS = () => ARG_WS || path.join(app.getPath('documents'), 'UOWA Content Specialist');
const TEMPLATE = () => app.isPackaged ? path.join(process.resourcesPath, 'project-template') : path.join(__dirname, '..', 'project-template');
const send = (ch, d) => { if (win && !win.isDestroyed()) win.webContents.send(ch, d); };
const runner = createRunner(send, WS);
registerUpdateIpc(() => win, () => !!runner.active());

const settings = () => lib.readSettings(WS(), !!keys.loadKey());
const engineOpts = (s, extra) => Object.assign({ apiKey: keys.loadKey(), models: s.models, thinking: s.thinking, timeoutSec: s.timeoutSec, retries: s.retries, humanizer: s.humanizer }, extra || {});

// ---- Classic engine (Gemini CLI). Fixed prompts only; the request goes through request.txt (UTF-8).
const PROMPT_NEW = 'Read the file request.txt in this folder. It contains the owner request for a new post. Handle it exactly as GEMINI.md describes: write the draft JSON, run the build command, fix any warnings, then reply briefly.';
const PROMPT_LEARN = 'The owner says: learn from my edits. Follow the section Learning from the owner edits in GEMINI.md.';
function modelFlag(s) { const m = s.models[0]; return (m && lib.isModelName(m)) ? ' -m ' + m : ''; }
const gemini = (p, s) => 'gemini' + modelFlag(s) + ' --yolo -p "' + p + '"';

// Fast engine: run fn in-process with the API options. Classic engine: hand the fixed prompt to Gemini CLI.
function runTask(kind, s, prompt, fn) {
  if (s.engine !== 'direct') return runner.startRun(kind, gemini(prompt, s));
  if (!keys.loadKey()) return { ok: false, error: 'nokey' };
  return runner.startEngineRun(kind, (signal, log) => fn(engineOpts(s, { signal, log }), log));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 860, minWidth: 760, minHeight: 600, autoHideMenuBar: true,
    title: 'UOWA Content Specialist',
    icon: path.join(__dirname, '..', 'renderer', 'logo.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

const version = cmd => new Promise(res => exec(cmd, { timeout: 20000, windowsHide: true }, (err, out) => res(err ? null : String(out).trim().split(/\r?\n/)[0])));

ipcMain.handle('status', async () => {
  const s = settings();
  return { version: app.getVersion(), workspace: WS(), platform: process.platform, engine: s.engine, model: s.models[0], key: keys.keySource(),
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
  const r = runner.startRun('rebuild', '"' + process.execPath + '" build.js "drafts/' + name + '.json"', { ELECTRON_RUN_AS_NODE: '1', NO_OPEN: '1' });
  const run = runner.active();
  if (r.ok && run) run.done.then(() => { if (fs.existsSync(html)) shell.openPath(html); });
  return r;
});

ipcMain.handle('post:create', (_e, text) => {
  const t = String(text || '').trim();
  if (!t) return { ok: false, error: 'empty' };
  const s = settings();
  if (s.engine !== 'direct') fs.writeFileSync(path.join(WS(), 'request.txt'), t + '\n', 'utf8');
  return runTask('new', s, PROMPT_NEW, async (opts, log) => {
    const res = await engine.createDraft(WS(), t, opts);
    log(res.warnings.length ? 'Draft created, but ' + res.warnings.length + ' warning(s) could not be fixed automatically. They are listed on the page under "Choices to confirm".\n' : 'Draft created.\n');
    if (fs.existsSync(res.html)) shell.openPath(res.html);
    return res;
  });
});

ipcMain.handle('learn', () => {
  const r = lib.importEdits(WS(), app.getPath('downloads'));
  send('run:log', 'Imported ' + r.moved.length + ' edited file(s) from Downloads.\n');
  return runTask('learn', settings(), PROMPT_LEARN, async (opts, log) => {
    const res = await engine.learnFromEdits(WS(), opts);
    log('\n' + res.summary + '\n');
    return res;
  });
});

ipcMain.handle('edits:import', () => lib.importEdits(WS(), app.getPath('downloads')));
ipcMain.handle('run:cancel', () => { runner.cancel(); return { ok: true }; });
ipcMain.handle('folder:open', () => shell.openPath(WS()));
ipcMain.handle('extension:open', () => shell.openPath(path.join(WS(), 'extension')));
ipcMain.handle('install:gemini', () => runner.startRun('install', 'npm install -g @google/gemini-cli'));
ipcMain.handle('install:node', () => {
  if (process.platform === 'win32') return runner.startRun('install', 'winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements');
  shell.openExternal('https://nodejs.org');
  return { ok: true };
});

// Key + engine settings
ipcMain.handle('key:save', (_e, k) => {
  const key = String(k || '').trim();
  if (key.length < 20 || key.length > 300 || /\s/.test(key)) return { ok: false, error: 'badformat' };
  keys.saveKey(key);
  return { ok: true, encrypted: safeStorage.isEncryptionAvailable() };
});
ipcMain.handle('key:clear', () => { keys.clearKey(); return { ok: true, source: keys.keySource() }; });
ipcMain.handle('key:test', async () => {
  if (!keys.loadKey()) return { ok: false, code: 'nokey' };
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
app.on('window-all-closed', () => { runner.cancel(); app.quit(); });
