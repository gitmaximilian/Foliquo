# Browser-only distribution

TranslateOCR is distributed as source code and runs in the user's browser against a local Node.js service. The project does not build or publish Electron applications, operating-system installers, or installable PWAs.

The repository download is a ZIP. One setup launcher prepares Node.js, LibreOffice, and npm dependencies where the operating system supports a package manager; a start launcher starts the local service and opens the default browser. The service binds to `127.0.0.1` only.

A new macOS application package would require a Developer ID signing identity and notarization for a dependable Gatekeeper experience. This project has no configured Apple Developer signing identity, so native application packaging was removed. Windows and Linux application packages were removed at the same time to keep the delivery model consistent.

Updates are checked against GitHub Releases. Users download the new source ZIP, replace the program files, preserve `.local`, and rerun setup. Local documents, settings, and credentials are never uploaded to GitHub by the update check.
