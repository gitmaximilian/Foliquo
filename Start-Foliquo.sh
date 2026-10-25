#!/usr/bin/env bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then echo 'Please run Setup-Foliquo.sh first.'; exit 1; fi
if [ ! -d node_modules/pdf-lib ]; then echo 'Preparing Foliquo ...'; npm ci --ignore-scripts || { echo 'Setup failed. Please run Setup-Foliquo.sh again.'; exit 1; }; fi
node scripts/start-browser.mjs
