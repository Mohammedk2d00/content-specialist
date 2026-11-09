// Sends an approved post to the dashboard tab, where content.js fills the open Add Post form.
// Replaces the old clipboard step. Returns {ok, fails} or {ok:false, error}.
const DASHBOARD = 'https://core-dashboard.uowa.edu.iq/';

async function dashboardTab() {
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (active && (active.url || '').startsWith(DASHBOARD)) return active;
  const tabs = await chrome.tabs.query({ url: DASHBOARD + '*', lastFocusedWindow: true });
  return tabs[0] || null;
}

async function fillForm(post) {
  const tab = await dashboardTab();
  if (!tab) return { ok: false, error: 'notab' };
  await chrome.tabs.update(tab.id, { active: true });
  try {
    return (await chrome.tabs.sendMessage(tab.id, { type: 'uowa-fill', post })) || { ok: false, error: 'other' };
  } catch (e) {
    return { ok: false, error: 'noscript' }; // the page was open before the extension loaded
  }
}

module.exports = { fillForm };
