@echo off
cd /d "%~dp0"
title UOWA Content Specialist (terminal)
where gemini >nul 2>nul
if errorlevel 1 (
  echo Gemini CLI is not installed yet. Run setup.bat first.
  pause
  exit /b 1
)
set "MODEL="
if exist model.txt set /p MODEL=<model.txt
if defined MODEL (gemini -m %MODEL%) else (gemini)
