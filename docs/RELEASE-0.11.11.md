# Foliquo Community v0.11.11 — Stable release

This is a regular stable release for Windows, macOS, and Linux, alongside the browser and CLI distributions. It is not a preview or prerelease.

## What changed

- Translation jobs now preserve the selected, versioned workspace context and completed safe checkpoints. After interruption, Foliquo can reuse completed steps; uncertain provider requests are not replayed automatically.
- Personal learning can analyze every page in selected PDF, DOCX, and scan sources in bounded, resumable sections. It records document structure, text layout, language and terminology proposals, with local OCR for supported scans. New knowledge remains inactive until the user reviews and approves it.
- When a translation is explicitly marked as finished and reviewed, Foliquo offers an optional way to add that version as a personal style sample. The prompt can be dismissed or permanently disabled.
- Review and clarification flows better identify source-linked risks, preserve decisions by document version, and keep unrelated fields separate.
- Multi-document preparation can split mixed imports into traceable jobs while preserving each job’s source pages and provenance.
- Provider usage now distinguishes reported API tokens and estimated API costs from unknown ChatGPT account limits. Local monthly API budgets can pause requests before a known estimate would reach the limit.
- Word export separates a narrow stamp box from the preceding full-width table. PDF and editable Word exports retain the 11 pt Aptos standard and original-page behavior.

These changes improve traceability and personal configuration. This release does not claim a measured improvement in translation quality; that requires evaluation with independent documents and users.

## Native desktop downloads

The direct Windows, macOS, and Linux installers are attached to the [Foliquo Desktop Apps v0.11.11 release](https://github.com/gitmaximilian/Foliquo/releases/tag/desktop-v0.11.11):

- Windows 10/11 x64: `Foliquo_0.11.11_x64-setup.exe`
- macOS 15+ Apple Silicon: `Foliquo-Desktop-macOS-arm64.dmg`
- macOS 15+ Intel: `Foliquo-Desktop-macOS-x64.dmg`
- Linux x64: `Foliquo-Desktop-0.11.11-Linux-x64.flatpak`
- The unsigned Windows MSIX is a Store-intake candidate, not the direct installer.

See the [desktop installation and update guide](https://github.com/gitmaximilian/Foliquo/blob/desktop-v0.11.11/docs/DESKTOP-APPS.md). Windows and macOS direct installers remain unsigned by their operating systems and may show first-install warnings. Linux updates are installed manually from a newer Flatpak bundle.

## Browser and CLI downloads

The `v0.11.11` release contains the browser/CLI packages, package-manager metadata, and checksums. Its description links to the direct desktop downloads above. Desktop bundles include the pinned Node runtime and LibreOffice Writer; browser/CLI installation requirements are listed in [DISTRIBUTION.md](DISTRIBUTION.md).
