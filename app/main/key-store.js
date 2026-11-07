// API key: stored per user outside the project folder, encrypted when the OS allows it.
const { app, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const KEYFILE = () => path.join(app.getPath('userData'), 'apikey.bin');
const envKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

function loadKey() {
  try {
    const s = fs.readFileSync(KEYFILE(), 'utf8');
    if (s.startsWith('enc1:')) return safeStorage.decryptString(Buffer.from(s.slice(5), 'base64'));
    if (s.startsWith('raw1:')) return s.slice(5);
  } catch (e) {}
  return envKey();
}
function keySource() {
  if (fs.existsSync(KEYFILE())) return 'saved';
  return envKey() ? 'env' : 'none';
}
function saveKey(k) {
  fs.mkdirSync(path.dirname(KEYFILE()), { recursive: true });
  const s = safeStorage.isEncryptionAvailable() ? 'enc1:' + safeStorage.encryptString(k).toString('base64') : 'raw1:' + k;
  fs.writeFileSync(KEYFILE(), s, { mode: 0o600 });
}
function clearKey() { try { fs.unlinkSync(KEYFILE()); } catch (e) {} }

module.exports = { loadKey, keySource, saveKey, clearKey };
