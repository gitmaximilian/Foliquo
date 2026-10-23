#!/bin/zsh
cd "${0:A:h}" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null; then
  print 'Node.js 22 oder neuer fehlt. Bitte nodejs.org verwenden.'
  read '?Enter zum Schließen.'
  exit 1
fi
if [[ ! -d node_modules/jose || ! -d node_modules/pdf-lib || ! -d node_modules/sharp || ! -d node_modules/fflate || ! -d node_modules/@expo-google-fonts/noto-serif ]]; then
  npm ci --ignore-scripts --no-audit --no-fund || exit 1
fi
node server.mjs &
translateocr_pid=$!
trap 'kill "$translateocr_pid" 2>/dev/null' EXIT INT TERM
for attempt in {1..30}; do
  if curl --silent --fail http://127.0.0.1:4318/ >/dev/null; then
    /usr/bin/open http://127.0.0.1:4318/
    print 'TranslateOCR läuft. Dieses Fenster zum Beenden schließen.'
    wait "$translateocr_pid"
    exit $?
  fi
  sleep 0.2
done
print 'TranslateOCR konnte nicht starten. Bitte prüfen, ob Port 4318 belegt ist.'
read '?Enter zum Schließen.'
