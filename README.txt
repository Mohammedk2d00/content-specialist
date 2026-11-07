UOWA CONTENT SPECIALIST - WINDOWS
=================================

FIRST TIME ONLY
1. Unzip this folder anywhere (for example C:\UOWA-Content-Specialist). Do not run it from inside the zip.
2. Double-click  setup.bat  (installs Node.js and Gemini CLI if missing, and downloads the app window engine).
   If it asks you to close the window and run it again, do that.
3. Install the browser extension (Chrome, Edge or Brave):
   open the extensions page, turn on "Developer mode", click "Load unpacked", choose the "extension" folder.
4. Double-click  UOWA Content Specialist.exe  (or start.bat) to open the app. Click "Sign in / first run" once and sign in to Gemini.

EVERY DAY
Double-click  UOWA Content Specialist.exe . A window opens. Type the post title, press "Create draft",
edit the page that opens in the browser, press Approved, then use "Import my edits" / "Learn from my edits".

UPDATES
Updates come as one small file ending in .uowapatch. Save it in your Downloads folder and open the app:
a message offers "Install and restart". (Or: Settings > "Install update file..." and choose the file.)
Your drafts, feedback, learned style rules, model.txt and settings are never changed by an update.

OTHER FILES
- start-terminal.bat : the old way, plain Gemini in a terminal window.
- tools\move-edits.bat : moves *.edited.json from Downloads into drafts (the app has a button for this).

NOTES
- Each computer needs its own Google sign-in / API key for Gemini CLI.
- If you use an API key, set it as a Windows environment variable (GEMINI_API_KEY) so the app window can see it.
- Your drafts are stored in Documents\drafts (setup.bat links it), so updating this folder never touches them.
- When updating, keep the "feedback" folder and the learned section of style-guide.md.

THE FAST ENGINE (default once a key is saved)
The window can talk to Google directly instead of driving Gemini CLI. It sends ONE writing request per post,
with a time limit, automatic retries and a backup model, then runs the same build check and fixes warnings
automatically (up to 3 times). It keeps all your rules: GEMINI.md, style-guide.md, examples, the humanizer
skills, the dashboard lists, "Learn from my edits". The Fast engine needs no Node.js and no Gemini CLI.
1. In the window, open "Connection", paste your Gemini API key, press "Save key", then "Test key".
   (Create the key in Google AI Studio with "Create API key". The key is stored only on this computer,
   outside this folder, so it is never copied when you share the folder.)
2. Use "Classic (Gemini CLI)" in the Engine list if you ever want the old way.

CHOOSING THE MODEL
Open model.txt in Notepad. The first line is the main model (default: gemini-3.5-flash). If it fails
repeatedly the app tries a backup model. Optional settings.json (advanced), for example:
  {"fallbackModels":["gemini-flash-latest"],"thinking":"low","timeoutSec":90,"retries":2,"humanizer":true}
- thinking: "", "minimal", "low", "medium" or "high" (less thinking = faster).
- humanizer:false leaves out the two long writing-skill files (shorter, cheaper requests).

LINUX (Manjaro, Arch, others)
1. Unzip anywhere. Open a terminal in the folder and run:  ./setup.sh
   (installs Node.js and the app engine, links your drafts to Documents/drafts, adds a menu entry and desktop icon).
2. Open "UOWA Content Specialist" from the application menu, or run ./start.sh
3. Install the browser extension as in the Windows steps above.
