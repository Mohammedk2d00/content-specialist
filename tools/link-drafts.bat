@echo off
setlocal
cd /d "%~dp0.."
set "DOCS="
for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('MyDocuments')"`) do set "DOCS=%%D"
if not defined DOCS set "DOCS=%USERPROFILE%\Documents"
set "TARGET=%DOCS%\drafts"
if not exist "%TARGET%" mkdir "%TARGET%"
dir /AL /B 2>nul | findstr /X /I "drafts" >nul && goto done
if exist "drafts\" (
  robocopy "drafts" "%TARGET%" /E /MOVE /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 8 (
    echo Could not move the old drafts folder. Nothing was linked.
    exit /b 1
  )
  rmdir "drafts" 2>nul
)
mklink /J "drafts" "%TARGET%" >nul
if errorlevel 1 (
  echo Could not create the drafts link.
  exit /b 1
)
:done
echo Drafts are stored in: %TARGET%
