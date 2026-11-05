@echo off
setlocal
cd /d "%~dp0.."
set "TARGET=%CD%\UOWA Content Specialist.exe"
if not exist "%TARGET%" set "TARGET=%CD%\start.bat"
set "ICON=%CD%\launcher\uowa.ico"
if not exist "%ICON%" set "ICON=%TARGET%"
powershell -NoProfile -Command "$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut($d+'\UOWA Content Specialist.lnk'); $s.TargetPath='%TARGET%'; $s.WorkingDirectory='%CD%\'; $s.IconLocation='%ICON%'; $s.Save()"
if errorlevel 1 (echo Could not create the desktop shortcut.) else (echo Desktop shortcut created.)
