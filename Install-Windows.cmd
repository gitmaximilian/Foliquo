@echo off
setlocal
cd /d "%~dp0"
set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>&1
if errorlevel 1 (
 call Setup-Windows.cmd
 if errorlevel 1 exit /b 1
)
node scripts\install-windows.mjs
pause
