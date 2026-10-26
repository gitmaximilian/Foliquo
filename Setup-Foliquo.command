#!/bin/zsh
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then
  echo 'Install Node.js 22+ (24 LTS recommended) and LibreOffice Writer, then run setup again.'
  echo 'Official downloads: https://nodejs.org/en/download and https://www.libreoffice.org/download/'
  exit 1
fi
node scripts/bootstrap.mjs || exit $?
if [[ "${FOLIQUO_SETUP_NO_START:-${TRANSLATEOCR_SETUP_NO_START:-}}" == "1" ]]; then exit 0; fi
node scripts/start-browser.mjs
read '?Foliquo stopped. Press Return to close ...'
