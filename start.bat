@echo off
setlocal
cd /d "%~dp0"
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "EXE=%ROOT%\app\node_modules\electron\dist\electron.exe"

if exist "%EXE%" goto run

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Run setup.bat first.
  pause
  exit /b 1
)

echo First start: downloading the app engine ^(about 100 MB, one time only^)...
pushd "%ROOT%\app"

rem remove a half-finished earlier install, then install again and show every message
if exist node_modules rmdir /s /q node_modules
call npm install --no-audit --no-fund --ignore-scripts=false --foreground-scripts
if exist "%EXE%" goto installed

echo.
echo The engine file was not downloaded. Trying the download step directly...
call node node_modules\electron\install.js
if exist "%EXE%" goto installed

echo.
echo Trying a mirror server...
set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
call node node_modules\electron\install.js
if exist "%EXE%" goto installed

popd
echo.
echo The download failed. Read the messages above. Check the internet connection,
echo antivirus or proxy, then run start.bat again.
pause
exit /b 1

:installed
popd

:run
start "" "%EXE%" "%ROOT%\app" --workspace="%ROOT%"
