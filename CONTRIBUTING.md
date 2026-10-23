# Contributing

Thanks for helping improve TranslateOCR. Keep contributions focused on the local browser workflow and preserve its clear boundary: this tool prepares drafts; a qualified translator remains responsible for certification.

## Local development

- Use Node.js 22 or newer.
- Run `npm ci --ignore-scripts` and `npm test`.
- For a full sample run, use `npm run benchmark`, `npm run acceptance`, and `npm run demo:build`.
- Start the local browser app with `npm start` or `node scripts/start-browser.mjs`.

## Guidelines

- Keep GitHub-facing documentation in English; interface copy belongs in the English, German, and Arabic dictionaries.
- Keep all demos and fixtures fictional. Never add real identity documents, translations, API keys, workspace files, or personal backups.
- Do not introduce native app packaging, PWA installation, or network exposure of the local service.
- Keep document content out of diagnostics and update checks.
- Add meaningful tests for parsing, data protection, update checking, and export changes. Avoid asserting model translation quality without a reviewed fixture.

Run all relevant checks before opening a pull request. Describe user-facing changes, tests, and any remaining platform-specific checks.
