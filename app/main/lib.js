// Pure Node helpers (no Electron), so they can be tested on their own.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

// Text of a workspace file, or '' when it is missing or unreadable.
function readText(dir, file) { try { return fs.readFileSync(path.join(dir, file), 'utf8'); } catch (e) { return ''; } }
// Model names go into a shell command (Classic engine), so allow only safe characters.
const isModelName = s => /^[A-Za-z0-9._-]+$/.test(s);

const KEEP = ['drafts', 'feedback', 'style-guide.md', 'request.txt', 'model.txt', 'engine.txt', 'settings.json']; // never overwritten on update

// Copy the bundled project into the user's workspace. First run: copy all.
// After an app update: refresh the code, keep drafts, feedback and the learned style guide.
function syncWorkspace(template, ws, version) {
  fs.mkdirSync(ws, { recursive: true });
  const vfile = path.join(ws, '.workspace-version');
  const cur = fs.existsSync(vfile) ? fs.readFileSync(vfile, 'utf8').trim() : null;
  if (cur === version) return { changed: false, first: false };
  for (const entry of fs.readdirSync(template)) {
    const destName = entry === '_gemini' ? '.gemini' : entry;
    const dest = path.join(ws, destName);
    if (KEEP.includes(destName) && fs.existsSync(dest)) continue;
    fs.cpSync(path.join(template, entry), dest, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(ws, 'drafts'), { recursive: true });
  fs.writeFileSync(vfile, version);
  return { changed: true, first: cur === null };
}

function listDrafts(ws) {
  const dir = path.join(ws, 'drafts');
  let files = [];
  try { files = fs.readdirSync(dir); } catch (e) { return []; }
  const out = [];
  for (const f of files) {
    if (!f.endsWith('.json') || f.endsWith('.edited.json')) continue;
    const name = f.slice(0, -5);
    let d = {};
    try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) {}
    out.push({
      name,
      title: d.request_title || name,
      titleAr: d.request_title_ar || '',
      created: d.created || '',
      hasHtml: fs.existsSync(path.join(dir, name + '.html')),
      hasEdited: fs.existsSync(path.join(dir, name + '.edited.json')),
      mtime: fs.statSync(path.join(dir, f)).mtimeMs
    });
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

// Move <draft>.edited.json from Downloads into drafts/ (only when the original draft exists).
function importEdits(ws, downloads) {
  const moved = [], skipped = [];
  let files = [];
  try { files = fs.readdirSync(downloads); } catch (e) { return { moved, skipped }; }
  for (const f of files) {
    if (!f.endsWith('.edited.json')) continue;
    const base = f.slice(0, -'.edited.json'.length);
    const orig = path.join(ws, 'drafts', base + '.json');
    if (!fs.existsSync(orig)) { skipped.push(f); continue; }
    const dest = path.join(ws, 'drafts', f);
    try { fs.renameSync(path.join(downloads, f), dest); }
    catch (e) { fs.copyFileSync(path.join(downloads, f), dest); fs.unlinkSync(path.join(downloads, f)); }
    moved.push(f);
  }
  return { moved, skipped };
}

// Run a shell command, stream its output. The command string must be built from fixed text only.
function runCommand(cmd, cwd, onData, env) {
  const child = spawn(cmd, {
    cwd, shell: true, windowsHide: true, detached: process.platform !== 'win32', // own process group, so cancel can kill the whole tree
    env: Object.assign({}, process.env, env || {}),
    stdio: ['pipe', 'pipe', 'pipe']
  });
  child.stdin.end(); // headless mode must not wait for input
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', onData); child.stderr.on('data', onData);
  const run = { child, cancelled: false };
  run.done = new Promise(resolve => {
    child.on('error', e => { onData('\n[error] ' + e.message + '\n'); resolve(-1); });
    child.on('close', code => resolve(code));
  });
  return run;
}

function killTree(run) {
  run.cancelled = true;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(run.child.pid), '/T', '/F'], { windowsHide: true });
  else { try { process.kill(-run.child.pid, 'SIGTERM'); } catch (e) { run.child.kill('SIGTERM'); } }
}

// Engine + model settings from workspace files (none of them hold secrets).
// model.txt first line = main model; settings.json (optional) = {fallbackModels, thinking, timeoutSec, retries, humanizer}; engine.txt = direct | cli
function readSettings(ws, hasKey) {
  const first = s => s.split(/\r?\n/)[0].trim();
  let extra = {}; try { extra = JSON.parse(readText(ws, 'settings.json') || '{}') || {}; } catch (e) {}
  const models = [];
  const main = first(readText(ws, 'model.txt')); models.push(isModelName(main) ? main : 'gemini-3.5-flash'); // empty or missing = default
  (Array.isArray(extra.fallbackModels) ? extra.fallbackModels : ['gemini-flash-latest']).forEach(m => { if (isModelName(String(m)) && !models.includes(m)) models.push(m); });
  let engine = first(readText(ws, 'engine.txt')).toLowerCase();
  if (engine !== 'cli' && engine !== 'direct') engine = hasKey ? 'direct' : 'cli';
  const num = (v, d, lo, hi) => (typeof v === 'number' && v >= lo && v <= hi) ? v : d;
  return {
    engine, models,
    thinking: ['', 'minimal', 'low', 'medium', 'high'].includes(extra.thinking) ? extra.thinking : 'low',
    timeoutSec: num(extra.timeoutSec, 90, 10, 600), retries: num(extra.retries, 2, 0, 5), humanizer: extra.humanizer !== false
  };
}

function hasCmd(c) { return spawnSync('which', [c]).status === 0; }

module.exports = { readText, isModelName, readSettings, syncWorkspace, listDrafts, importEdits, runCommand, killTree, hasCmd, KEEP };
