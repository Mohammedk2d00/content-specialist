0</* :
@echo off
title UOWA Content Specialist - Upgrade
where node >nul 2>nul || (echo Node.js was not found. Run setup.bat in your app folder first. & pause & exit /b 1)
node "%~f0" %*
pause
exit /b
*/0;
// One-time upgrade for copies made before the patch updater existed. tools/make-upgrade.js appends the payload
// (every app file, never the user's own files) to a copy of this template. This file is both a batch file and Node code.
const fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib');
const { execFileSync, spawn } = require('child_process');

// Old GUI copies keep app/main.js; reorganized ones (1.0.1+) keep app/main/main.js. Both must be upgradable.
const isApp = d => !!d && fs.existsSync(path.join(d, 'build.js'))
  && ['main.js', path.join('main', 'main.js')].some(f => fs.existsSync(path.join(d, 'app', f)));
// Force UTF-8 output: PowerShell otherwise prints in the OEM code page and Arabic/accented folder names arrive garbled.
const ps = cmd => { try { return execFileSync('powershell', ['-NoProfile', '-Command', '[Console]::OutputEncoding=[Text.Encoding]::UTF8;' + cmd], { encoding: 'utf8' }).trim(); } catch (e) { return ''; } };
const subDirs = d => { try { return fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => path.join(d, e.name)); } catch (e) { return []; } };
// Users often pick one level off: the "app" subfolder, its parent, or the outer folder an unzip creates.
const resolveApp = d => !d ? null : [d, path.dirname(d), path.dirname(path.dirname(d)), ...subDirs(d)].find(isApp) || null;
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const waitEnter = () => { try { fs.readSync(0, Buffer.alloc(64)); } catch (e) { /* no console input: continue */ } };
const stop = msg => { console.log('\n' + msg); process.exit(1); };

// The app folder: given on the command line, next to this file, from the desktop shortcut setup.bat made, or picked by hand.
function findFolder() {
  if (process.argv[2] && resolveApp(path.resolve(process.argv[2]))) return resolveApp(path.resolve(process.argv[2]));
  if (isApp(path.dirname(process.argv[1]))) return path.dirname(process.argv[1]);
  const lnk = ps("$p=[Environment]::GetFolderPath('Desktop')+'\\UOWA Content Specialist.lnk'; if(Test-Path $p){(New-Object -ComObject WScript.Shell).CreateShortcut($p).WorkingDirectory}").replace(/\\$/, '');
  if (isApp(lnk)) return lnk;
  console.log('Could not find the app folder by itself. Choose it in the window that opens.');
  const pick = ps("Add-Type -AssemblyName System.Windows.Forms; $f=New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description='Choose the UOWA Content Specialist folder'; if($f.ShowDialog() -eq 'OK'){$f.SelectedPath}");
  if (pick && !resolveApp(pick)) console.log('That folder is not the app folder (no app\\main.js or app\\main\\main.js, and no build.js): ' + pick);
  return resolveApp(pick);
}

function readPayload() {
  const text = fs.readFileSync(process.argv[1], 'utf8');
  const at = text.lastIndexOf('\n//' + 'PAYLOAD:');
  if (at < 0) stop('This is the upgrade template, not an upgrade file. Build one with tools/make-upgrade.js.');
  return JSON.parse(zlib.gunzipSync(Buffer.from(text.slice(at + 11).trim(), 'base64')).toString('utf8'));
}

const appRunning = () => { try { return /electron\.exe/i.test(execFileSync('tasklist', ['/FI', 'IMAGENAME eq electron.exe'], { encoding: 'utf8' })); } catch (e) { return false; } };

const body = readPayload();
console.log('UOWA Content Specialist: upgrade to version ' + body.to + '\n');
const root = findFolder();
if (!root) stop('No app folder chosen. Nothing was changed.');
let current = '?';
try { current = JSON.parse(fs.readFileSync(path.join(root, 'app', 'package.json'), 'utf8')).version; } catch (e) { /* unknown version */ }
console.log('App folder:  ' + root + '\nInstalled:   ' + current + '\nNew version: ' + body.to);
console.log('\nYour drafts, feedback, learned style rules and settings are kept.');
console.log('Press Enter to upgrade, or close this window to cancel.');
waitEnter();

if (appRunning()) { console.log('Please close the UOWA Content Specialist window. Waiting...'); while (appRunning()) sleep(1500); }

// Unpack into a temp folder, then let the NEW version's patcher install it (backup + rollback on any error).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uowa-upgrade-'));
try {
  for (const [rel, b64] of Object.entries(body.files)) {
    if (!/^[^\\:]+$/.test(rel) || rel.split('/').includes('..')) stop('Damaged upgrade file. Nothing was changed.');
    fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
    fs.writeFileSync(path.join(tmp, rel), Buffer.from(b64, 'base64'));
  }
  const n = require(path.join(tmp, 'app', 'main', 'patcher.js')).applyPatch(root, body);
  console.log('\nDone: ' + n + ' files updated. A backup of the old files is in ' + path.join(root, '.patch-backup'));
} catch (e) {
  stop('The upgrade failed and the old files were put back.\n' + (e && e.message || e));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (process.env.UOWA_NO_LAUNCH) process.exit(0); // tests: do not open the app
const exe = path.join(root, 'UOWA Content Specialist.exe');
const child = fs.existsSync(exe) ? spawn(exe, [], { cwd: root, detached: true, stdio: 'ignore' })
  : spawn('cmd.exe', ['/c', 'start', '', 'start.bat'], { cwd: root, detached: true, stdio: 'ignore' });
child.on('error', () => {}); child.unref();
console.log('Opening the app. From now on, updates are single .uowapatch files: just double-click them.');
