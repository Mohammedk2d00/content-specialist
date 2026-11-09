UOWA CONTENT SPECIALIST - BROWSER EXTENSION
===========================================

Everything happens in your browser, next to the dashboard. Nothing else to install.
Works in Chrome, Edge and Brave.

FIRST TIME ONLY
1. Download UOWA-Extension.zip from the project's Releases page and unzip it into a folder you will keep,
   for example Documents\UOWA-Extension. Do not delete or move this folder later.
2. Open the extensions page (chrome://extensions, edge://extensions or brave://extensions).
3. Turn on "Developer mode" (top right), press "Load unpacked" and choose the unzipped folder.
4. Pin the extension: press the puzzle icon in the toolbar, then the pin next to "UOWA Content Specialist".
5. Click the extension icon. A panel opens on the side. Follow the yellow card: open Google AI Studio,
   press "Create API key", paste the key into the panel and press Save. The key stays in this browser only.

EVERY DAY
1. Open the dashboard and click the extension icon.
2. Type the post title (and any facts you have) and press "Write the draft".
3. The draft opens in a new tab. Check and edit both languages, then press Approved on the last tab (Media).
4. In the dashboard open Add Post, then press "Fill Arabic form" (or "Fill English form") in the side panel.
   The extension fills the form but never presses Create. Add the URL, date and image yourself, then press Create.

LEARNING FROM YOUR EDITS
In the panel, open Settings and press "Learn from my edits". The writer looks for corrections you made
in 2 or more approved drafts and turns them into style rules.
To give your rules to a colleague: Settings > "Save my rules to a file", and they use "Load rules from a file".

UPDATES
Download the new UOWA-Extension.zip, unzip it over the same folder (replace the files), then press Reload
on the extension's card on the extensions page. Your drafts, key and learned rules are kept.
Keep the folder in the same place: removing the extension deletes its drafts and rules.

FOR THE MAINTAINER
Folders:
  extension/   the product. Load this folder unpacked. dist/ and rules/ inside it are built, not edited.
  rules/       what the writer follows: GEMINI.md, style-guide.md, examples/, dashboard-lists.json,
               latin-allowlist.txt, sample-draft.json, humanizer/. Rebuild after changing them.
  shared/      code used by both the extension and the scripts: checks/, learn/, utils/, lists.js, templates/.
  scripts/     build-extension.js, selftest.js, and the command-line tools build.js, learn.js, lookup.js.
  tests/       engine test (fake browser and network).
- npm install, then npm run build (node scripts/build-extension.js). Press Reload on the extension after each build.
- npm test runs the self-test and the engine test (no key, no internet).
- Tag a version (git tag v2.0.1 && git push --tags) to publish a new UOWA-Extension.zip release.
