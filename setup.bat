@echo off
setlocal
cd /d "%~dp0"
title UOWA Content Specialist - Setup
echo.
echo  === UOWA Content Specialist: one-time setup ===
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [1/4] Node.js is not installed. Installing the LTS version...
  where winget >nul 2>nul
  if errorlevel 1 (
    echo.
    echo  winget was not found. Please install Node.js LTS by hand from:
    echo  https://nodejs.org   then run setup.bat again.
    pause
    exit /b 1
  )
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  echo.
  echo  Node.js was installed. CLOSE this window and run setup.bat once more
  echo  so Windows picks up the new Node.js.
  pause
  exit /b 0
) else (
  echo [1/4] Node.js found:
  node --version
)

echo.
where gemini >nul 2>nul
if errorlevel 1 (
  echo [2/4] Installing Gemini CLI...
  call npm install -g @google/gemini-cli
  if errorlevel 1 (
    echo.
    echo  Gemini CLI install failed. Check the internet connection and try again.
    pause
    exit /b 1
  )
) else (
  echo [2/4] Gemini CLI found.
)

echo.
echo [3/4] Downloading the app window engine (about 100 MB, one time)...
pushd "%~dp0app"
call npm install --no-audit --no-fund
popd

echo.
echo [4/4] Moving drafts to Documents and checking the project files...
call link-drafts.bat
node selftest.js
if errorlevel 1 (
  echo.
  echo  The self-test reported a problem. Send a screenshot of this window to the project owner.
  pause
  exit /b 1
)

echo.
echo  Setup finished.
echo  Next: double-click "UOWA Content Specialist.exe" (or start.bat) to open the app window.
echo  Also install the browser extension once (see README.txt, step 3).
echo.
pause
