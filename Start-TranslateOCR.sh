#!/usr/bin/env bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then echo 'Please run Setup-TranslateOCR.sh first.'; exit 1; fi
if [ ! -d node_modules/pdf-lib ]; then echo 'Preparing TranslateOCR ...'; npm ci --ignore-scripts || { echo 'Setup failed. Please run Setup-TranslateOCR.sh again.'; exit 1; }; fi
node scripts/start-browser.mjs
