@echo off
setlocal
cd /d "%~dp0"
set "PATH=%ProgramFiles%\nodejs;%PATH%"
node scripts\launch-desktop.mjs
if errorlevel 1 pause
