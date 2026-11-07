// Online update check: looks at the latest GitHub release for a .uowapatch and downloads it, so users get updates
// without anyone sending them files. The patch is still signature-checked before it is offered or installed,
// so a tampered download is ignored. Any network problem just means "no update this time".
const { net } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// UOWA_UPDATE_URL lets a local test server stand in for GitHub; the signature check still applies.
const LATEST = process.env.UOWA_UPDATE_URL || 'https://api.github.com/repos/Mohammedk2d00/content-specialist/releases/latest';

// The .uowapatch asset of the latest release, or null.
async function latestPatchAsset() {
  const r = await net.fetch(LATEST, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'uowa-content-specialist' } });
  if (!r.ok) return null;
  const rel = await r.json();
  return (rel.assets || []).find(a => /\.uowapatch$/i.test(a.name)) || null;
}

// Downloads the asset into dir (once; reuses an earlier download) and returns the file path.
async function download(asset, dir) {
  const name = path.basename(asset.name);
  const file = path.join(dir, name);
  if (fs.existsSync(file) && fs.statSync(file).size === asset.size) return file;
  const r = await net.fetch(asset.browser_download_url);
  if (!r.ok) throw new Error('download failed: ' + r.status);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file + '.part', Buffer.from(await r.arrayBuffer()));
  fs.renameSync(file + '.part', file); // never leave a half file that looks finished
  return file;
}

// Returns the downloaded patch path, or null when offline / no release / no patch asset.
async function fetchLatestPatch(dir) {
  try {
    const asset = await latestPatchAsset();
    return asset ? await download(asset, dir) : null;
  } catch (e) {
    return null;
  }
}

module.exports = { fetchLatestPatch };
