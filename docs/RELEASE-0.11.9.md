## Foliquo Community v0.11.9 — Desktop apps

This stable release adds PDF scan cropping, selectable local OCR text, clearer clarification controls, and more consistent document formatting. It also fixes a Windows desktop keyboard-event panic and refreshes the fictional demo examples.

### Downloads

- Windows 10/11 x64 installer: `Foliquo_0.11.9_x64-setup.exe`
- Windows MSIX Store-intake candidate: `Foliquo-Desktop-0.11.9-Windows-x64-Store-intake.msix` (not for direct installation)
- macOS 15+ Apple Silicon: `Foliquo-Desktop-macOS-arm64.dmg`
- macOS 15+ Intel: `Foliquo-Desktop-macOS-x64.dmg`
- Linux x64 Flatpak bundle: `Foliquo-Desktop-0.11.9-Linux-x64.flatpak`
- `SHA256SUMS` verifies the packages and per-platform build reports.

The desktop packages include the pinned Node runtime and LibreOffice Writer. Windows and macOS can install verified in-app updates from this version onward; Linux updates remain manual. Users on desktop v0.11.8 can update inside the app. Earlier versions must first be updated manually to v0.11.8.

PDF and Word exports keep 11 pt Aptos and use a tighter layout only when it can fit a translation onto one page without explicit page breaks or a saved custom template. Original source pages remain appended to PDF downloads.

The Windows installer and macOS applications are not signed with paid platform certificates and may show first-install warnings. The MSIX is an unsigned Store-intake candidate. No Microsoft Store, Mac App Store, or Flathub approval is implied.

See the [desktop install guide](https://github.com/gitmaximilian/Foliquo/blob/desktop-v0.11.9/docs/DESKTOP-APPS.md) for installation and update steps.
