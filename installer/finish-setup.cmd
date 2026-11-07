@echo off
rem Runs once, hidden, at the end of the wizard (see finish-setup.iss). It installs what a first launch needs.
rem Output goes to installer\setup.log, so messages are English: a hidden window has no reader, and the log is for support.
rem Node.js may have just been installed, so this process does not know its PATH yet: add it by hand.
setlocal
cd /d "%~dp0.."
set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH%"
del "installer\setup-ok" 2>nul

echo [1/3] Gemini CLI
where gemini >nul 2>nul || call npm install -g @google/gemini-cli --no-audit --no-fund
where gemini >nul 2>nul || (echo FAILED: Gemini CLI did not install. & exit /b 1)

echo [2/3] App engine (about 100 MB)
pushd app
call npm install --no-audit --no-fund
popd
if not exist "app\node_modules\electron\dist\electron.exe" (echo FAILED: app engine did not download. & exit /b 2)

echo [3/3] Drafts folder
call tools\link-drafts.bat
if errorlevel 1 (echo FAILED: drafts folder. & exit /b 3)

rem Hide everything except what the user needs, so the folder looks tidy. Only top-level items: nested files stay normal.
rem The app updater restores each top-level file's hidden state itself when it updates it.
for /d %%D in (*) do if /i not "%%D"=="extension" if /i not "%%D"=="drafts" attrib +h "%%D"
for %%F in (*) do if /i not "%%F"=="UOWA Content Specialist.exe" if /i not "%%F"=="README.txt" attrib +h "%%F"

rem The wizard only offers "Launch" when this marker exists.
echo ok> "installer\setup-ok"
echo DONE
exit /b 0
