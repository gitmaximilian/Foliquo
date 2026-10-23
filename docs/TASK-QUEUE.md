# Product task queue

1. [x] Improve translation output, date formatting, direct downloads, and optional review.
2. [x] Add private style-example learning and onboarding.
3. [x] Review the layout for balance, RTL wordmark handling, and demo access.
4. [x] Remove all native desktop packages and PWA installation; make the browser workflow the only delivery path.
5. [x] Add guided setup and browser launchers for Windows, macOS, and Linux.
6. [x] Add a GitHub release check and a local-data-preserving update guide.
7. [x] Run the full test, benchmark, and acceptance suites; verify the three-language demo and run setup plus PDF/Word export on Apple Silicon. CI now runs each platform's setup script on Windows, macOS, and Linux. A clean-machine install on a separate Windows/Linux computer remains useful real-world acceptance.
8. [ ] Update the public GitHub repository and publish a source-only release after checks.

The public v0.8.7 desktop release predates the browser-only decision. Do not recommend or publish native installers. The next release must be source-only; the in-app update button downloads that release's source ZIP directly.
