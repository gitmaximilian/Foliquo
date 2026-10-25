@echo off
setlocal
cd /d "%~dp0"
title Foliquo
where node >nul 2>&1 || (echo Please run Setup-Foliquo.cmd first. & pause & exit /b 1)
if not exist node_modules\pdf-lib (echo Preparing Foliquo ... & call npm.cmd ci --ignore-scripts || (echo Setup failed. Please run Setup-Foliquo.cmd again. & pause & exit /b 1))
node scripts\start-browser.mjs
pause
