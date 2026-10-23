#!/bin/sh
cd "$(dirname "$0")"
node scripts/install-desktop.mjs
printf '\nMit Eingabetaste schließen.\n'
read _
