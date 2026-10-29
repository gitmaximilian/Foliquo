## Foliquo Community v0.11.7 — Desktop apps

Foliquo desktop apps for Windows, macOS, and Linux are ready for direct download. This is a regular GitHub release, not a preview or prerelease.

### Downloads

- Windows 10/11 x64 per-user installer: `Foliquo_0.11.7_x64-setup.exe`
- Windows unsigned MSIX Store-intake candidate: `Foliquo-Desktop-0.11.7-Windows-x64-Store-intake.msix`
- macOS 15+ Apple Silicon: `Foliquo-Desktop-macOS-arm64.dmg`
- macOS 15+ Intel: `Foliquo-Desktop-macOS-x64.dmg`
- Linux x64 Flatpak bundle: `Foliquo-Desktop-0.11.7-Linux-x64.flatpak`
- `SHA256SUMS` verifies package and report downloads.

The direct Windows installer, macOS apps, and Linux bundle include the pinned Node runtime and LibreOffice Writer for document export. The direct Windows installer also includes the WebView2 offline setup. The app uses Foliquo’s local-only service and retains user data in the platform data directory. It can reuse a compatible service and opens ChatGPT login in the system browser.

**Unsigned packages:** Windows may display SmartScreen. macOS packages are unsigned and not notarized, so Gatekeeper can require a one-time per-app approval. Linux is a local bundle and is not published on Flathub. No trusted publisher signature is claimed.

**MSIX limitation:** The unsigned MSIX is only a Store-intake candidate, not an end-user installer. Its manifest identity is provisional and must exactly match the app identity assigned in Partner Center before submission. It is not Store-certified or Store-signed and is not suitable for direct side-loading. Use the Windows per-user installer for direct installation.

See the [desktop install guide](https://github.com/gitmaximilian/Foliquo/blob/desktop-v0.11.7/docs/DESKTOP-APPS.md) for platform-specific steps and warnings.
