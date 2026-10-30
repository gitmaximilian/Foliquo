# Foliquo desktop apps

Free desktop packages for Windows 10/11 x64, macOS 15+ (Apple Silicon and Intel), and Linux x64 are attached to the [desktop apps release](https://github.com/gitmaximilian/Foliquo/releases/tag/desktop-v0.11.11). The release includes checksums and per-platform build reports. These are direct downloads; the GitHub Actions artifact browser is not needed.

## Downloads

- Windows x64 direct installer: `Foliquo_0.11.11_x64-setup.exe`
- Windows MSIX Store-intake candidate: `Foliquo-Desktop-0.11.11-Windows-x64-Store-intake.msix` (not for direct installation; see below)
- macOS Apple Silicon: `Foliquo-Desktop-macOS-arm64.dmg`
- macOS Intel: `Foliquo-Desktop-macOS-x64.dmg`
- Linux x64: `Foliquo-Desktop-0.11.11-Linux-x64.flatpak`

The Windows installer is a regular unsigned per-user installer. Windows SmartScreen may show a warning because the community app has no paid code-signing certificate. The macOS apps are unsigned and not notarized; after verifying the download, macOS may require a one-time Open Anyway approval in System Settings → Privacy & Security. Do not turn off either operating system’s protection globally. The Linux package is a local Flatpak bundle, not a Flathub listing. No store certification or trusted publisher signature is claimed.

The separate MSIX is an unsigned Store-intake candidate, not an end-user installer. Its manifest identity is provisional; its Name and Publisher must exactly match the app identity assigned in Partner Center before submission. The candidate is not Store-certified or Store-signed and is not suitable for direct side-loading.

## Install

### Windows

Download the Windows installer and run it for the current Windows account. The package includes the Node runtime, LibreOffice Writer for PDF and Word exports, and the WebView2 offline installer. If SmartScreen appears, verify that the file came from the Foliquo GitHub release before choosing the operating system’s per-app option to continue. Start Foliquo from the Start menu.

### macOS

Choose the DMG matching the Mac’s processor, open it, and drag Foliquo into Applications. On first launch, use the one-time approval in Privacy & Security if Gatekeeper blocks these unsigned packages. Apple Silicon and Intel packages are separate.

### Linux

Install Flatpak if needed, then install the downloaded bundle:

```sh
flatpak install --user ./Foliquo-Desktop-0.11.11-Linux-x64.flatpak
```

Flatpak can fetch the GNOME 50 runtime when it is not already installed. Start Foliquo from the application menu or with:

```sh
flatpak run at.maximilianauer.foliquo
```

## Data and connections

The app window uses the same local Foliquo service as the browser version. The service listens only on `127.0.0.1`; the app starts and stops its own service, or reuses a compatible service for the same data directory. Existing settings, provider connections, and jobs remain in the platform data directory. The package does not include workspace or account data. ChatGPT sign-in opens the system browser and returns through a one-time local callback; the user completes account selection and plan consent.

The original browser and CLI use remain available. Desktop packages include the pinned Node runtime and LibreOffice Writer, so a separate Node or LibreOffice installation is not needed. PDF and Word export uses the bundled Writer installation.

## Updates and verification

Windows and macOS apps check for updates when Foliquo starts and periodically while it is open. A dialog shows the new version; choosing **Update now** downloads the Tauri-signed updater package, verifies it, installs it, and restarts Foliquo. The private updater key stays in GitHub Actions secrets; the public verification key is embedded in the app. Linux continues to update by installing a newer Flatpak manually.

Versions v0.11.8 and newer can update to v0.11.11 from inside Foliquo. Users of earlier versions must first install v0.11.8 manually because it introduced the updater. Updates preserve the private workspace. Use the release’s `SHA256SUMS` file to verify direct downloads. Windows and macOS packages remain unsigned and do not imply Microsoft Store, Mac App Store, or Flathub approval.

The latest source and build workflow are on the [`main` branch](https://github.com/gitmaximilian/Foliquo/tree/main). Each platform build publishes a report alongside its checksums. The packages include the required upstream license and notice files; see [third-party notices](THIRD-PARTY.md).
