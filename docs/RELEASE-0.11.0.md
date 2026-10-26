# Foliquo Community 0.11.0

This release keeps the browser interface and loopback-only backend while introducing curated platform distributions and durable per-user private storage.

- Fixed the demo language selector's native macOS appearance, arrow, RTL spacing and 44 px touch target.
- Added a `foliquo` CLI for start, stop, diagnostics and explicit legacy-data migration.
- Added verified, non-overwriting workspace migration; originals remain as recovery copies.
- Added native-dependency archives for macOS Apple Silicon/Intel and Linux x64, and a per-user Windows x64 Inno Setup installer with bundled Node.js, Start-menu shortcuts and uninstaller.
- Added exact package manifests, archive integrity checks, SHA-256 checksums, Homebrew formula generation and WinGet manifest generation.
- Added platform installation checks and a staged release pipeline. Existing published releases and automatic GitHub source archives remain unchanged.

Download the artifact for your operating system, verify it against SHA256SUMS, and follow [the setup guide](https://github.com/gitmaximilian/Foliquo/blob/v0.11.0/docs/BROWSER-SETUP.md). LibreOffice Writer remains a separately installed prerequisite. macOS archives are intended for Homebrew. Linux requires a compatible Node.js installation; Windows bundles the exact maintained Node.js version recorded in the repository.

Homebrew publication is separate from release publication. WinGet manifests require validation, submission, Microsoft review and indexing before a Foliquo installation command is available. Consult the main README for the current publication status. Installer signature status is recorded in windows-signature.json; unsigned builds and new certificates may trigger SmartScreen warnings.

Private data now lives outside the application directory. Before migrating, stop the old instance and keep its `.local` folder. The setup guide explains explicit migration and recovery. Upgrades and uninstallers do not remove the private workspace.

Foliquo Community remains subject to PolyForm Noncommercial 1.0.0. It is source-available with noncommercial restrictions, not OSI-approved open source. Translation, OCR, provider connections and the human-review boundary remain unchanged.
