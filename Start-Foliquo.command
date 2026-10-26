#!/bin/zsh
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then echo 'Install Node.js 22+ and run Setup-Foliquo.command first.'; exit 1; fi
if [ ! -d node_modules/pdf-lib ]; then echo 'Run Setup-Foliquo.command first.'; exit 1; fi
node bin/foliquo.mjs
read '?Foliquo stopped. Press Return to close ...'
