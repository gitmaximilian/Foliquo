# Foliquo Community v0.11.10 — Stable release

This is a regular stable release for Windows, macOS, and Linux, alongside the browser and CLI distributions. It is not a preview or prerelease.

## What changed

- The desktop app now waits up to 60 seconds for its local service to become ready. This includes the slow-start fix that was missing from the v0.11.9 desktop packages.
- The opened source-document viewer offers one-click **Copy all text** using local OCR, while keeping selectable OCR text available.
- Translation cleanup now preserves square-bracket descriptions for logos, coats of arms, and signatures in table rows. Unreadable signatures never trigger clarification questions.
- Windows keeps the guarded Tao keyboard handling for orphan dead-character events.
- PDF downloads continue to append every original source page after the translated page(s). Word files remain editable and use 11 pt Aptos.

## Native desktop downloads

The direct Windows, macOS, and Linux installers are attached to the [Foliquo Desktop Apps v0.11.10 release](https://github.com/gitmaximilian/Foliquo/releases/tag/desktop-v0.11.10):

- Windows 10/11 x64: `Foliquo_0.11.10_x64-setup.exe`
- macOS 15+ Apple Silicon: `Foliquo-Desktop-macOS-arm64.dmg`
- macOS 15+ Intel: `Foliquo-Desktop-macOS-x64.dmg`
- Linux x64: `Foliquo-Desktop-0.11.10-Linux-x64.flatpak`
- The unsigned Windows MSIX is a Store-intake candidate, not the direct installer.

See the [desktop installation and update guide](https://github.com/gitmaximilian/Foliquo/blob/desktop-v0.11.10/docs/DESKTOP-APPS.md). The Windows installer and macOS apps are unsigned and may show first-install warnings. Linux updates are installed manually from a newer Flatpak bundle.

## Browser and CLI downloads

The `v0.11.10` release contains the browser/CLI packages, package-manager metadata, and checksums. Its description links back to the direct desktop downloads above. The desktop bundles include the pinned Node runtime and LibreOffice Writer; browser/CLI installation requirements are listed in the [distribution guide](DISTRIBUTION.md).
