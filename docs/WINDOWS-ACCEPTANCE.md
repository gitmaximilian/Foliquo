# Windows acceptance checklist

Before recommending a release on Windows, test the setup and browser launcher on a clean Windows 10/11 account:

- Setup installs or detects Node.js 22+ and LibreOffice, then finishes `npm ci` and the local installation check.
- The launcher starts the local service, opens the default browser, and stops cleanly when its terminal window closes.
- The service is reachable only at `127.0.0.1:4318`.
- Test fictional image, multi-page PDF, and Word input; clarify an unreadable value; download PDF and Word; close and reopen to confirm local jobs persist.
- Test update notification with a newer release and with GitHub unavailable. Confirm the per-user private directory and any legacy `.local` recovery copy remain intact.

Record Windows version, CPU architecture, browser, test results, and any manual package-manager prompts. Do not claim a platform check until it has been run on a real Windows machine.

## Packaged installer acceptance

The release workflow runs packaging/windows/test-installer.ps1 against the actual EXE. It checks silent install, bundled Node without system Node on PATH, Start-menu shortcut, first/repeated launch, exports, protected stop, same-version reinstall and uninstall with the private key retained.

Still record a clean non-administrator Windows account's visual first launch and SmartScreen behavior, plus an actual older-to-newer installer upgrade. Do not replace those checks with the automated same-version reinstall result. Record Authenticode status and Microsoft WinGet PR/review/index status separately.
