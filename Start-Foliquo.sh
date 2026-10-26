#!/usr/bin/env sh
set -eu
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1; then echo 'Install Node.js 22+ and run Setup-Foliquo.sh first.' >&2; exit 1; fi
if [ ! -d node_modules/pdf-lib ]; then echo 'Run Setup-Foliquo.sh first.' >&2; exit 1; fi
exec node bin/foliquo.mjs
