#!/bin/zsh
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then open 'https://nodejs.org/en/download'; echo 'Please install Node.js LTS, then run Setup-Foliquo.command.'; read '?Press Return to close ...'; exit 1; fi
if [ ! -d node_modules/pdf-lib ]; then echo 'Preparing Foliquo ...'; npm ci --ignore-scripts || { echo 'Setup failed. Please run Setup-Foliquo.command again.'; read '?Press Return to close ...'; exit 1; }; fi
node scripts/start-browser.mjs
read '?Foliquo stopped. Press Return to close ...'
