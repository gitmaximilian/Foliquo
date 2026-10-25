# Security and privacy

Foliquo is designed for one person using a local browser interface and a loopback-only service.

- The HTTP service binds to `127.0.0.1`; it is not intended to be exposed to the internet or a local network.
- The encrypted workspace, sessions, credentials, jobs, and samples live in `.local/`. Never commit this folder or share it in a public issue.
- API keys remain in the encrypted local workspace. A selected AI provider receives document content only when the user starts a model-backed task.
- The GitHub update check sends only an HTTP request for the public latest-release metadata. It does not send documents, provider credentials, or settings.
- The setup scripts may install Node.js and LibreOffice using the operating system package manager. Review the repository source before running them.
- Keep the browser on `http://127.0.0.1:4318/`; do not configure a public reverse proxy without adding authentication, TLS, tenant isolation, upload controls, and a separate security review.

Report vulnerabilities privately to the repository owner rather than including personal documents, credentials, or exploit details in a public issue. This project is experimental and has not received a formal security audit.
