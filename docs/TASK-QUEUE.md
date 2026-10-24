# Product task queue

1. [x] Improve translation output, date formatting, direct downloads, and optional review.
2. [x] Add private style-example learning and onboarding.
3. [x] Review the layout for balance, RTL wordmark handling, and demo access.
4. [x] Remove all native desktop packages and PWA installation; make the browser workflow the only delivery path.
5. [x] Add guided setup and browser launchers for Windows, macOS, and Linux.
6. [x] Add a GitHub release check and a local-data-preserving update guide.
7. [x] Run the full test, benchmark, and acceptance suites; verify the three-language demo and run setup plus PDF/Word export on Apple Silicon. CI now runs each platform's setup script on Windows, macOS, and Linux. A clean-machine install on a separate Windows/Linux computer remains useful real-world acceptance.
8. [x] Update the public GitHub repository and publish v0.9.1 as the latest source-only release after all platform checks pass.

Legacy desktop releases and installer downloads have been removed from GitHub. The repository description and download guidance now describe browser use. Only the current source-code release is retained for the in-app update check.

## Browser workspace v0.9.2

- [x] Move AI settings into the header and include live setup in onboarding.
- [x] Add scan and clarification dialogs with encrypted draft persistence.
- [x] Add a narrow jobs sidebar, per-job progress, accessible status colors and an active processing outline.
- [x] Simplify the workspace, editing page, Guide, footer and three-language controls.
- [x] Confirm suggestions individually and allow explicit unreadable answers for all questions.
- [x] Match cancel/delete controls and clarify the start-page hierarchy.
Release target: v0.9.2, distributed as browser source only.
