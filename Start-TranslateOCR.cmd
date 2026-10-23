@echo off
setlocal
cd /d "%~dp0"
title TranslateOCR
where node >nul 2>&1 || (echo Please run Setup-TranslateOCR.cmd first. & pause & exit /b 1)
if not exist node_modules\pdf-lib (echo Preparing TranslateOCR ... & call npm.cmd ci --ignore-scripts || (echo Setup failed. Please run Setup-TranslateOCR.cmd again. & pause & exit /b 1))
node scripts\start-browser.mjs
pause
