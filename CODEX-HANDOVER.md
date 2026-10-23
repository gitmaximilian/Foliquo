# Maintainer handover

TranslateOCR is an open-source local browser application. The Node.js service binds to `127.0.0.1:4318`; browser JavaScript talks to that service using same-origin requests and CSRF tokens. Do not expose the service publicly or add native desktop/PWA packages.

## Main files

- `server.mjs`: local HTTP API, sessions, ChatGPT OAuth, provider routes, translation queue, review, static assets, and GitHub update metadata check.
- `lib/`: document conversion, queue, provider adapters, encrypted workspace, learning samples, diagnosis, revisions, PDF/Word export.
- `dist/index.html`, `dist/style.css`, and `dist/*.js`: browser UI and the English/German/Arabic dictionaries.
- `scripts/start-browser.mjs`: starts the local service and opens the user's existing browser.
- `Setup-TranslateOCR.*` and `Start-TranslateOCR.*`: one-click package setup and browser launcher per OS.
- `dist/demo/`: fictional three-language demo.

## Privacy and releases

The `.local/` directory is private and ignored by Git. It contains encrypted local workspace data and credentials. Never include it in source archives, tests, or screenshots. The update checker makes a request to the public GitHub Releases API and returns only version metadata and the official release URL.

Publish source-only releases. Do not attach EXE, DMG, DEB, RPM, Electron, or PWA packages. The update UI links to GitHub Releases; when publishing a newer release, keep the version in `package.json` and `/api/session` in sync.

## Checks

Use Node.js 22+, install dependencies with `npm ci --ignore-scripts`, and run `npm test`, `npm run benchmark`, `npm run demo:build`, and `npm run acceptance`. `docs/WINDOWS-ABNAHME.md` lists platform checks still requiring actual user machines.
