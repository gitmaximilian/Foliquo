# Foliquo Community distribution verification

## Current release — 0.11.3

[Release 0.11.3](https://github.com/gitmaximilian/Foliquo/releases/tag/v0.11.3) is public for Windows x64, Linux x64, and macOS ARM64/Intel, with actual checksums and signature status. [All release gates passed](https://github.com/gitmaximilian/Foliquo/actions/runs/40465445154), including 140 tests on the native builds, both Homebrew architectures and official WinGet validation.

The official Homebrew tap points to 0.11.3. An actual public Homebrew upgrade from 0.11.1 to 0.11.3 passed locally; private workspace key, preferences and ChatGPT authorization were preserved and all eight live models remained available.

[WinGet submission #462448](https://github.com/microsoft/winget-pkgs/pull/462448) now contains the generated 0.11.3 manifests. Microsoft moderation/indexing is still pending; no public WinGet command for Foliquo is advertised. The previously documented hosted WinGet installation limitation remains separate from the successful native installer lifecycle checks.

The unpublished 0.11.2 candidate was cancelled before publication to include version-neutral installation links. Its tag was preserved, without a binary release. Website downloads and the real-app screenshot were updated to 0.11.3.

## Original 0.11.1 verification


Version: 0.11.1. Published on October 26, 2026 after all release gates passed.

| Deliverable | Implemented and verified behavior |
| --- | --- |
| Architecture | Existing browser UI; loopback-only Node backend; official pinned Node bundled on macOS and Windows; Linux uses a compatible system Node. No Electron, PWA or background service. |
| macOS | Native ARM64/Intel archives, generated checksummed Homebrew formula, `foliquo` start/stop/doctor/migrate CLI, persistent per-user storage. Public tap published at https://github.com/gitmaximilian/homebrew-tap; the actual public install command, PDF/Word doctor, start/stop and uninstall/data preservation passed locally on macOS ARM64. |
| Windows | Per-user x64 Inno Setup EXE, bundled Node, Start-menu entries, optional desktop shortcut, stable uninstall identity, silent install and uninstaller. Current installer is unsigned. |
| Linux | Curated x64/glibc archive, integrity-checked user-local installation and version directories; no installer sudo or downloaded shell execution. |
| Release files | Windows x64 setup EXE; macOS ARM64 and x64 tarballs; Linux x64 tarball; SHA256SUMS; packaging metadata ZIP and signature status. |
| Legacy files | TranslateOCR launch/setup aliases remain only in source for compatibility and are absent from curated user packages. Developer tests, planning documents, caches and private data are excluded. Historical releases and tags are not rewritten. |
| Migration | Verifies encrypted bytes/key, preferences and synthetic provider credentials; copies into an empty private per-user directory; preserves the original; rejects corruption, symbolic links, ownership problems, changing files and occupied destinations. |
| Automation | Three-platform CI, four native distribution builds, staged draft-to-public release, exact version/lockfile checks, dependency audit, archive verification, Homebrew tests and pinned official WinGet validation. Separate published-manifest installation test and package-manager update workflow. |
| Documentation | English README/setup/maintainer/security and release guides explain actual prerequisites, storage, migration, update and uninstall. Generated/prepared/published/indexed states are distinguished. |
| Demo and website | Native selector appearance corrected; visible localized return to the Projects list; genuine running-demo screenshot in README; real desktop/mobile Source Review screenshots on the existing bilingual website. |
| Tests | 136 tests, offline benchmark with zero regressions, LibreOffice PDF/DOCX doctor and acceptance; actual Windows silent installer lifecycle; Homebrew style/audit/install/start/stop/reinstall/uninstall and preserved data on ARM64 and Intel; Linux real installation; native package integrity checks. |
| Limits | Physical Windows clean-account/SmartScreen visual testing and historical-version upgrade are separate manual checks. Same-version reinstall is not presented as that historical upgrade. Code signing needs a valid certificate. Microsoft review/indexing cannot be represented as package availability. The CLA check passed following the account owner’s explicit approval. |

Public website: https://maximilianauer.at/projects/foliquo/
Repository implementation: https://github.com/gitmaximilian/Foliquo/pull/3

## Published installation paths

- macOS: `brew install --cask libreoffice`, `brew install gitmaximilian/tap/foliquo`, then `foliquo`.
- Windows: download [the per-user x64 installer](https://github.com/gitmaximilian/Foliquo/releases/download/v0.11.1/Foliquo-Community-0.11.1-Windows-x64-Setup.exe), install LibreOffice Writer, and open Foliquo Community from Start. `Foliquo.exe doctor` checks exports.
- Linux: install Node.js 22+, LibreOffice Writer and xdg-utils; download the Linux x64 tarball and SHA256SUMS from the release, verify, extract, run `./install.sh`, then `~/.local/bin/foliquo`.
- [Release assets and checksums](https://github.com/gitmaximilian/Foliquo/releases/tag/v0.11.1).
- [Successful release gates](https://github.com/gitmaximilian/Foliquo/actions/runs/40405697137): four native builds, two native Homebrew lifecycles and official WinGet 1.29.380 validation.
- Historical v0.11.0 tag is retained but has no published release because its gates failed. Tags and old releases were not rewritten.

## Remaining manual acceptance

Physical Windows clean-account interaction and SmartScreen appearance, a historical-version installer upgrade, optional Authenticode certificate configuration, and Microsoft's independent review/indexing remain separate. The account owner approved the CLA and Microsoft's license/cla check passed. No OS protection was disabled. For future automatic tap-update pull requests, a narrowly scoped TAP_GITHUB_TOKEN is optional; the first public tap was published using the existing authorized account.

## Package-manager publication evidence

- [Public tap CI](https://github.com/gitmaximilian/homebrew-tap/actions/runs/40408197556): both ARM64 and Intel passed against public immutable release downloads.
- [WinGet submission #462448](https://github.com/microsoft/winget-pkgs/pull/462448): open; CLA passed; not merged or indexed at report time. No public Foliquo WinGet installation command is advertised.
- [Package-update preparation](https://github.com/gitmaximilian/Foliquo/actions/runs/40408998522): passed, including metadata download/checksum/extraction. Without the optional scoped tap token it produces reviewed update files rather than claiming an automatic repository update.
- The existing website was published through its original Cloudflare Pages project. German navigation from Demo back to `/projects/?lang=de` was verified by an actual public browser click. Desktop/mobile source-review images and README image were captured from the running demo.

## WinGet acceptance limitation

[Published-manifest acceptance run](https://github.com/gitmaximilian/Foliquo/actions/runs/40409514273) passed official manifest validation and public installer download/hash verification. WinGet then stalled at “Starting package install…” and the bounded test failed after four minutes. Process diagnostics showed WinGet but no Foliquo setup process; no Inno installer log was created. This does not establish the root cause. Full WinGet installation/uninstallation is **not verified** and remains a required desktop-session or Microsoft review check. The separately tested Windows installer and public direct download remain available. The Microsoft PR explicitly leaves this acceptance checkbox unchecked.

All source CI jobs passed on Windows, macOS and Linux after the final prerequisite-check change ([run](https://github.com/gitmaximilian/Foliquo/actions/runs/40409774527)). A transient Chocolatey HTTP 504 had exposed a false-success prerequisite install; CI now checks Writer actually exists and retries the feed before failing clearly. No application or release asset changed after the successful v0.11.1 release gates.
