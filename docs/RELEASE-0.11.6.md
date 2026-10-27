## Foliquo Community v0.11.6 — Desktop Preview

Free desktop packages for Windows, macOS, and Linux are ready for direct download. This is a pre-release for the desktop app; the stable browser and CLI release remains unchanged.

### Downloads

- Windows 10/11 x64 per-user installer: `Foliquo_0.11.6_x64-setup.exe`
- macOS 15+ Apple Silicon: `Foliquo-Desktop-macOS-arm64.dmg`
- macOS 15+ Intel: `Foliquo-Desktop-macOS-x64.dmg`
- Linux x64 Flatpak bundle: `Foliquo-Desktop-0.11.6-Linux-x64.flatpak`
- `SHA256SUMS` verifies package and report downloads.

The app bundles the pinned Node runtime and LibreOffice Writer for document export. Windows includes the WebView2 offline setup. The app uses Foliquo’s local-only service and retains user data in the platform data directory. It can reuse a compatible service and opens ChatGPT login in the system browser.

**Unsigned preview:** Windows may display SmartScreen. macOS packages are unsigned and not notarized, so Gatekeeper can require a one-time per-app approval. Linux is a local bundle and is not published on Flathub. These packages are not store-certified, and no trusted publisher signature is claimed. See the [desktop install guide](https://github.com/gitmaximilian/Foliquo/blob/desktop-preview-v0.11.6/docs/DESKTOP-PREVIEW.md) before installing.
