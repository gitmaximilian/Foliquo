# Maintainer handover

Foliquo Community is a source-available local browser application under PolyForm Noncommercial 1.0.0. The Node.js service binds to `127.0.0.1:4318`; browser JavaScript talks to that service using same-origin requests and CSRF tokens. Do not expose the service publicly. Native installers may wrap the browser service; do not add Electron or a PWA.

## Main files

- `server.mjs`: local HTTP API, sessions, ChatGPT OAuth, provider routes, translation queue, review, static assets, and GitHub update metadata check.
- `lib/`: document conversion, queue, provider adapters, encrypted workspace, learning samples, diagnosis, revisions, PDF/Word export.
- `dist/index.html`, `dist/style.css`, and `dist/*.js`: browser UI and the English/German/Arabic dictionaries.
- `scripts/start-browser.mjs`: starts the local service and opens the user's existing browser.
- `Setup-Foliquo.*` and `Start-Foliquo.*`: one-click package setup and browser launcher per OS.
- `dist/demo/`: fictional three-language demo.

## Privacy and releases

Legacy `.local/` directories are private and ignored by Git. New installations use the per-user path returned by `foliquo data-dir`; migration copies and verifies the legacy directory without deleting it. It contains encrypted local workspace data and credentials. Never include it in source archives, tests, or screenshots. The update checker makes a request to the public GitHub Releases API and returns only version metadata and the official release URL.

Publish curated, platform-specific release assets through the verified distribution workflow. Preserve PolyForm Noncommercial 1.0.0; do not describe it as OSI open source. The update UI links to GitHub Releases; when publishing a newer release, keep the version in `package.json` and `/api/session` in sync.

## Checks

Use Node.js 22+, install dependencies with `npm ci --ignore-scripts`, and run `npm test`, `npm run benchmark`, `npm run demo:build`, and `npm run acceptance`. `docs/WINDOWS-ACCEPTANCE.md` lists platform checks still requiring actual user machines.
