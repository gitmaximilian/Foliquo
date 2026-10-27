# Desktop preview packages

The `codex/native-desktop` branch builds the optional Foliquo desktop window on GitHub Actions. Open the **Desktop preview packages** workflow, choose the latest successful branch run, and download the artifact for your operating system. These are preview artifacts; no version tag, GitHub Release, Microsoft Store listing, or Flathub submission is created by this workflow.

| Artifact | Contents | Status |
| --- | --- | --- |
| `desktop-macOS-arm64`, `desktop-macOS-x64` | `.app` ZIP and `.dmg` | Unsigned and unnotarized. macOS may require a manual first-launch approval in Privacy & Security. Managed Macs may disallow it. |
| `desktop-Windows-x64` | Native NSIS installer and unsigned MSIX preview | The installer can trigger SmartScreen. The MSIX has a preview identity and cannot be treated as Store-signed or directly installable without the required publisher identity/signing process. |
| `desktop-Linux-x64` | Locally built Flatpak bundle | Install a suitable Flatpak runtime and review the declared permissions before installing. This build is not on Flathub. |

The desktop package contains the pinned Node runtime, application, and LibreOffice Writer for PDF/Word conversion. The original browser and CLI packages remain available. The window opens the same loopback service (`127.0.0.1`), and it stops only a service it started itself. An existing service can be reused only if it supports the desktop bridge. Close an older service before opening the preview. The app uses the current platform data directory; it never adds private workspace data to package artifacts.

ChatGPT sign-in opens the system browser and returns to Foliquo through a one-time loopback callback. The user must complete any account selection and plan consent. Returning focus to the desktop window refreshes its connection status. The normal browser interface keeps its same-browser callback.

The Windows MSIX manifest's preview publisher is intentionally not a Microsoft Store publisher identity. Before any Store submission, reserve the app in Partner Center and replace the package Name and Publisher with the exact assigned values, then certify the final package. No identity or signing credentials belong in the repository. The existing GitHub release workflow is not used for desktop previews.

## Build locally

Use official Node matching `.node-version`, a Rust stable toolchain, and the platform's Tauri prerequisites. Install LibreOffice Writer on the build host. Run `npm ci --ignore-scripts` and `npm run desktop:build`. This stages an isolated copy of the app, Node, and LibreOffice under ignored `desktop/generated/`; it does not copy any `.local` workspace or account credentials. Linux additionally runs `bash desktop/linux/build-flatpak.sh` after the Tauri `.deb` build; Windows runs `desktop/windows/build-msix.ps1` after the NSIS build. The CI workflow performs these steps on the corresponding operating systems and retains downloads for 30 days.
