@echo off
rem Runs once, at the end of the wizard, in the installed app folder. It installs what a first launch needs.
rem Node.js was just installed, so this window does not know its PATH yet: add it by hand.
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH%"
title UOWA Content Specialist

echo.
echo  [1/3] تثبيت Gemini CLI ...
where gemini >nul 2>nul || call npm install -g @google/gemini-cli --no-audit --no-fund
where gemini >nul 2>nul || (echo  فشل تثبيت Gemini CLI. تحقق من الإنترنت ثم أعد تشغيل المثبّت. & pause & exit /b 1)

echo.
echo  [2/3] تنزيل محرك التطبيق ^(حوالي 100 ميغابايت، مرة واحدة^) ...
pushd app
call npm install --no-audit --no-fund
popd
if not exist "app\node_modules\electron\dist\electron.exe" (
  echo  فشل تنزيل المحرك. تحقق من الإنترنت ثم أعد تشغيل المثبّت. & pause & exit /b 1
)

echo.
echo  [3/3] تجهيز مجلد المسودات ...
call tools\link-drafts.bat
exit /b 0
