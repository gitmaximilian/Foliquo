@echo off
setlocal
cd /d "%~dp0"
title TranslateOCR Setup
echo.
echo  Setting up TranslateOCR
echo  The first setup takes a few minutes. It will open in your browser when ready.
echo.
where node >nul 2>&1 || (where winget >nul 2>&1 && winget install --exact --id OpenJS.NodeJS.LTS --source winget)
set "PATH=%ProgramFiles%\nodejs;%LocalAppData%\Programs\nodejs;%PATH%"
node -e "if(Number(process.versions.node.split('.')[0])<22)process.exit(1)" >nul 2>&1
if errorlevel 1 goto missing_node
if not exist "%ProgramFiles%\LibreOffice\program\soffice.exe" if not exist "%ProgramFiles(x86)%\LibreOffice\program\soffice.exe" (where winget >nul 2>&1 && winget install --exact --id TheDocumentFoundation.LibreOffice --source winget)
if not exist "%ProgramFiles%\LibreOffice\program\soffice.exe" if not exist "%ProgramFiles(x86)%\LibreOffice\program\soffice.exe" goto missing_office
echo  Preparing TranslateOCR ...
call npm.cmd ci --ignore-scripts
if errorlevel 1 goto install_failed
echo  Checking PDF and Word export ...
node scripts\check-install.mjs
if errorlevel 1 goto check_failed
echo.
echo  Setup is complete. TranslateOCR is opening in your browser.
echo  Keep this window open while you use TranslateOCR. Press Ctrl+C to stop it.
echo.
if "%TRANSLATEOCR_SETUP_NO_START%"=="1" exit /b 0
node scripts\start-browser.mjs
pause
exit /b 0
:missing_node
echo.
echo  Node.js 22 or newer is required. Install Node.js LTS from:
echo  https://nodejs.org/en/download
echo  Then run this setup file again.
pause
exit /b 1
:missing_office
echo.
echo  LibreOffice is required for PDF and Word export.
echo  Install it from https://www.libreoffice.org/download/ and run setup again.
pause
exit /b 1
:install_failed
echo.
echo  Setup could not install the project files. Check your internet connection and run setup again.
pause
exit /b 1
:check_failed
echo.
echo  The export check failed. Please check the LibreOffice installation and run setup again.
pause
exit /b 1
