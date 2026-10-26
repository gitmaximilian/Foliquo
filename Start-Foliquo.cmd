@echo off
setlocal
cd /d "%~dp0"
title Foliquo Community
where node >nul 2>&1 || (echo Install Node.js 22+ and run Setup-Foliquo.cmd first. & pause & exit /b 1)
if not exist node_modules\pdf-lib (echo Run Setup-Foliquo.cmd first. & pause & exit /b 1)
node bin\foliquo.mjs
pause
