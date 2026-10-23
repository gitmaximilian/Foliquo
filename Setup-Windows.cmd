@echo off
setlocal
set "SetupResult=1"
cd /d "%~dp0"
echo TranslateOCR - Windows Setup
echo.
where node >nul 2>&1
if errorlevel 1 (
  where winget >nul 2>&1
  if errorlevel 1 goto NeedNode
  choice /M "Node.js LTS ueber den Windows-Paketmanager installieren"
  if errorlevel 2 goto End
  winget install --exact --id OpenJS.NodeJS.LTS --source winget
  if errorlevel 1 goto Failed
)
set "PATH=%ProgramFiles%\nodejs;%PATH%"
node -e "if(Number(process.versions.node.split('.')[0])<22)process.exit(1)"
if errorlevel 1 goto NeedNode
if defined TRANSLATEOCR_SOFFICE goto Dependencies
if exist "%ProgramFiles%\LibreOffice\program\soffice.exe" goto Dependencies
if exist "%ProgramFiles(x86)%\LibreOffice\program\soffice.exe" goto Dependencies
where winget >nul 2>&1
if errorlevel 1 goto NeedOffice
choice /M "LibreOffice ueber den Windows-Paketmanager installieren"
if errorlevel 2 goto End
winget install --exact --id TheDocumentFoundation.LibreOffice --source winget
if errorlevel 1 goto Failed
:Dependencies
where npm.cmd >nul 2>&1
if errorlevel 1 goto NeedNode
call npm.cmd ci --ignore-scripts
if errorlevel 1 goto Failed
node scripts\check-install.mjs
if errorlevel 1 goto Failed
echo.
set "SetupResult=0"
echo Fertig. Jetzt Start-TranslateOCR.cmd doppelklicken.
echo Danach das eigene ChatGPT-Konto in der Anwendung verbinden.
goto End
:NeedNode
echo Bitte Node.js 24 LTS von https://nodejs.org/ installieren.
echo Anschliessend dieses Setup erneut starten.
goto End
:NeedOffice
echo Bitte LibreOffice von https://www.libreoffice.org/download/ installieren.
echo Anschliessend dieses Setup erneut starten.
goto End
:Failed
echo.
echo Einrichtung nicht abgeschlossen. Die Fehlermeldung oben in Codex pruefen.
echo Anleitung: WINDOWS-START.md und CODEX-HANDOVER.md
:End
pause
exit /b %SetupResult%
