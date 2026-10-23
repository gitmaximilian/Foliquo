#!/bin/zsh
cd "$(dirname "$0")"
printf '\nSetting up TranslateOCR\nThe first setup takes a few minutes. It will open in your browser when ready.\n\n'
if ! command -v node >/dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  if command -v brew >/dev/null; then
    echo 'Installing Node.js ...'
    brew install node || { echo 'Node.js could not be installed. Please try again or visit https://nodejs.org/en/download.'; read '?Press Return to close ...'; exit 1; }
  else
    open 'https://nodejs.org/en/download'
    echo 'Install Node.js LTS, then run this setup file again.'
    read '?Press Return to close ...'
    exit 1
  fi
fi
if ! command -v soffice >/dev/null; then
  if command -v brew >/dev/null; then
    echo 'Installing LibreOffice ...'
    brew install --cask libreoffice || { echo 'LibreOffice could not be installed. Please try again.'; read '?Press Return to close ...'; exit 1; }
  else
    open 'https://www.libreoffice.org/download/download-libreoffice/'
    echo 'Install LibreOffice, then run this setup file again.'
    read '?Press Return to close ...'
    exit 1
  fi
fi
echo 'Preparing TranslateOCR ...'
npm ci --ignore-scripts || { echo 'Setup could not install the project files. Check your internet connection and run setup again.'; read '?Press Return to close ...'; exit 1; }
echo 'Checking PDF and Word export ...'
node scripts/check-install.mjs || { echo 'The export check failed. Please check LibreOffice and run setup again.'; read '?Press Return to close ...'; exit 1; }
echo '\nSetup is complete. TranslateOCR is opening in your browser.'
echo 'Keep this window open while you use TranslateOCR. Press Ctrl+C to stop it.'
if [[ "${TRANSLATEOCR_SETUP_NO_START:-}" == "1" ]]; then exit 0; fi
node scripts/start-browser.mjs
read '?TranslateOCR stopped. Press Return to close ...'
