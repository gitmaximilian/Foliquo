# Desktop preview packages

Version **0.11.5** adds free desktop preview packages. Open the [Desktop preview packages workflow](https://github.com/gitmaximilian/Foliquo/actions/workflows/desktop-preview.yml), choose the latest successful run on `codex/native-desktop`, then download the matching artifact. GitHub keeps these workflow artifacts for 30 days. They are not versioned releases; the workflow does not publish a Microsoft Store or Flathub listing.

| Artifact | Contents | Status |
| --- | --- | --- |
| `desktop-macOS-arm64`, `desktop-macOS-x64` | `.app` ZIP and `.dmg` | Unsigned and unnotarized. macOS may require a manual first-launch approval in Privacy & Security. Managed Macs may disallow it. |
| `desktop-Windows-x64` | Native NSIS installer and unsigned MSIX preview | The installer can trigger SmartScreen. The MSIX has a preview identity and cannot be treated as Store-signed or directly installable without the required publisher identity/signing process. |
| `desktop-Linux-x64` | Locally built Flatpak bundle | Install a suitable Flatpak runtime and review the declared permissions before installing. This build is not on Flathub. |

The desktop package contains the pinned Node runtime, application, and LibreOffice Writer for PDF/Word conversion. It does not require a separate Node or LibreOffice installation. The original browser and CLI packages remain available. The window opens the same loopback service (`127.0.0.1`), and it stops only a service it started itself. An existing service can be reused only if it supports the desktop bridge. Close an older service before opening the preview. The app uses the current platform data directory; it never adds private workspace data to package artifacts.

## Install the preview

- **macOS:** Open the `.dmg`, drag Foliquo to Applications, then open it. These builds are free and unsigned, so Gatekeeper may require you to use **Open Anyway** under Privacy & Security after you have downloaded the package from the official workflow. Do not disable Gatekeeper globally. Both Apple Silicon and Intel packages are provided.
- **Windows:** Run the Windows `*-setup.exe` installer for the direct preview. Windows may show SmartScreen because this community build is unsigned. The `.msix` is a packaging preview and may not install because it has no Microsoft Store publisher identity; it is not a Store-certified installer.
- **Linux:** Install Flatpak, download the `desktop-Linux-x64` artifact, and install the included bundle with `flatpak install --user ./Foliquo-Desktop-0.11.5-Linux-x64.flatpak`. Flatpak can install the GNOME 50 runtime if it is missing. Start Foliquo from the application menu or with `flatpak run at.maximilianauer.foliquo`.

To update a preview, download and install the newest artifact for your platform. Private workspace data is kept in the platform data directory and is preserved. Preview artifacts expire after 30 days; download a copy locally if you need to retain one.

ChatGPT sign-in opens the system browser and returns to Foliquo through a one-time loopback callback. The user must complete any account selection and plan consent. Returning focus to the desktop window refreshes its connection status. The normal browser interface keeps its same-browser callback.

The Windows MSIX manifest's preview publisher is intentionally not a Microsoft Store publisher identity. Before any Store submission, reserve the app in Partner Center and replace the package Name and Publisher with the exact assigned values, then certify the final package. No identity or signing credentials belong in the repository. The existing GitHub release workflow is not used for desktop previews.

## Build locally

Use official Node matching `.node-version`, a Rust stable toolchain, and the platform's Tauri prerequisites. Install LibreOffice Writer on the build host, then run `npm ci --ignore-scripts`. On Windows and Linux, run `npm run desktop:build`. On macOS, run `npm run desktop:prepare && cd desktop && ../node_modules/.bin/tauri build --bundles app`; the CI workflow creates the DMG from that app with `hdiutil`. Preparation stages an isolated copy of the app, Node, and LibreOffice under ignored `desktop/generated/`; it does not copy any `.local` workspace or account credentials. Linux additionally runs `bash desktop/linux/build-flatpak.sh` after the Tauri `.deb` build; Windows runs `desktop/windows/build-msix.ps1` after the NSIS build. The CI workflow performs these steps on the corresponding operating systems and retains downloads for 30 days.
