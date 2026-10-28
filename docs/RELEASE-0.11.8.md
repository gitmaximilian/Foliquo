## Foliquo Community v0.11.8 — Desktop apps

This regular release adds verified in-app updates to the Windows and macOS desktop apps. Foliquo checks for a new version at startup and periodically while it is open. When an update is available, choose **Update now** to download, verify, and install it. Windows restarts through the installer; macOS relaunches Foliquo after installation.

Users on v0.11.7 must install this release once using the normal platform installer. Future Windows and macOS updates can then be installed inside the app. Linux remains a manual Flatpak update.

### Downloads

- Windows 10/11 x64 per-user installer: `Foliquo_0.11.8_x64-setup.exe`
- Windows unsigned MSIX Store-intake candidate: `Foliquo-Desktop-0.11.8-Windows-x64-Store-intake.msix` (not for direct installation)
- macOS 15+ Apple Silicon: `Foliquo-Desktop-macOS-arm64.dmg`
- macOS 15+ Intel: `Foliquo-Desktop-macOS-x64.dmg`
- Linux x64 Flatpak bundle: `Foliquo-Desktop-0.11.8-Linux-x64.flatpak`
- `SHA256SUMS` and per-platform build reports

Each desktop package includes the pinned Node runtime and LibreOffice Writer for PDF and Word export. The Windows installer also includes the WebView2 offline setup.

The Tauri updater verifies update packages with a dedicated public key embedded in the app. Its private signing key is stored as a GitHub Actions secret. This signature does not add Windows Authenticode signing or Apple notarization: first-install OS warnings can still appear. Linux does not use the updater feed.

The MSIX remains unsigned and uses a provisional identity. It is not a direct installer or a Store-certified package.

See the [desktop install guide](https://github.com/gitmaximilian/Foliquo/blob/desktop-v0.11.8/docs/DESKTOP-APPS.md) for platform-specific steps and warnings.
