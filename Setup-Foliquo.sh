#!/usr/bin/env sh
set -eu
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 22+ (24 LTS recommended) and LibreOffice Writer with your distribution package manager, then run setup again.' >&2
  exit 1
fi
node scripts/bootstrap.mjs
if [ "${FOLIQUO_SETUP_NO_START:-${TRANSLATEOCR_SETUP_NO_START:-}}" = '1' ]; then exit 0; fi
exec node scripts/start-browser.mjs
