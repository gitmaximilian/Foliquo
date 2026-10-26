#!/usr/bin/env sh
set -eu
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 22+ (24 LTS recommended) and LibreOffice Writer using your distribution package manager, then run this installer again.' >&2
  exit 1
fi
exec node "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/scripts/install-linux.mjs"
