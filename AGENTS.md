# TranslateOCR repository notes

TranslateOCR is a browser-only application backed by a local Node.js service. Do not add native desktop packages or installable PWA behavior. Keep the local service bound to loopback (`127.0.0.1`) and preserve the browser-only setup and update guide.

## Development

- Node.js 22+; install dependencies with `npm ci --ignore-scripts`.
- Run `npm test`, `npm run benchmark`, `npm run acceptance`, and `npm run demo:build` for relevant changes.
- Keep all repository documentation and default GitHub-facing content in English. The interface supports English, German, and Arabic.
- Demo documents must be fictional. Never add customer documents, tokens, `.local/`, or backup data to Git.
- Keep update checks read-only; never send user documents, settings, or credentials to GitHub.
- Preserve the original PDF and Word export behavior and the explicit human-review boundary for certified translations.
