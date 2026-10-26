@echo off
setlocal
cd /d "%~dp0"
title Foliquo Community Setup
where node >nul 2>&1 || goto missing_node
node scripts\bootstrap.mjs
if errorlevel 1 exit /b 1
if "%FOLIQUO_SETUP_NO_START%"=="1" exit /b 0
if "%TRANSLATEOCR_SETUP_NO_START%"=="1" exit /b 0
node scripts\start-browser.mjs
pause
exit /b 0
:missing_node
echo Install Node.js 22+ and LibreOffice Writer, then run setup again.
echo Official downloads: https://nodejs.org/en/download and https://www.libreoffice.org/download/
pause
exit /b 1
