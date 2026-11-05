@echo off
cd /d "%~dp0"
title Move edited drafts
set "DL=%USERPROFILE%\Downloads"
set COUNT=0
for %%F in ("%DL%\*.edited.json") do (
  move /Y "%%F" "%~dp0drafts\" >nul
  echo Moved %%~nxF
  set /a COUNT+=1
)
if %COUNT%==0 (echo No .edited.json files found in %DL%) else (echo Done. Now tell Gemini: learn from my edits)
echo.
pause
