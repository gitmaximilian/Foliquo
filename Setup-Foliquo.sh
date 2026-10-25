#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo
echo 'Setting up Foliquo.'
echo 'The first setup takes a few minutes. It will open in your browser when ready.'
echo
major=0
if command -v node >/dev/null; then major="$(node -p 'Number(process.versions.node.split(".")[0])')"; fi
if [ "$major" -lt 22 ]; then
  if command -v apt-get >/dev/null; then
    echo 'Preparing Node.js. Linux may ask for your computer password.'
    installer="$(mktemp)"
    curl -fsSL https://deb.nodesource.com/setup_24.x -o "$installer"
    sudo -E bash "$installer"
    rm -f "$installer"
    sudo apt-get install -y nodejs
  elif command -v dnf >/dev/null; then
    echo 'Preparing Node.js. Linux may ask for your computer password.'
    sudo dnf install -y nodejs npm
  else
    echo 'Install Node.js LTS from https://nodejs.org/en/download, then run this setup file again.'
    command -v xdg-open >/dev/null && xdg-open https://nodejs.org/en/download || true
    exit 1
  fi
fi
if ! command -v soffice >/dev/null; then
  echo 'LibreOffice is required for PDF and Word export.'
  if command -v apt-get >/dev/null; then sudo apt-get install -y libreoffice
  elif command -v dnf >/dev/null; then sudo dnf install -y libreoffice
  else echo 'Install LibreOffice from https://www.libreoffice.org/download/, then run this setup file again.'; exit 1; fi
fi
echo 'Preparing Foliquo ...'
npm ci --ignore-scripts || { echo 'Setup could not install the project files. Check your internet connection and run setup again.'; exit 1; }
echo 'Checking PDF and Word export ...'
node scripts/check-install.mjs
echo
echo 'Setup is complete. Foliquo is opening in your browser.'
echo 'Keep this window open while you use Foliquo. Press Ctrl+C to stop it.'
if [ "${FOLIQUO_SETUP_NO_START:-${TRANSLATEOCR_SETUP_NO_START:-}}" = "1" ]; then exit 0; fi
node scripts/start-browser.mjs
