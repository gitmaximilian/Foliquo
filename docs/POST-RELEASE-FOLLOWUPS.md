# Community post-release follow-ups

Verified on October 30, 2026, after the release owner finished: **0.11.11 is publicly published as regular Stable and Desktop releases.** This follow-up performed independent read-only publication checks and reconciled the comparison documentation. It did not start application builds, change tags/releases, republish the website, recruit users, or make provider calls.

## Publication evidence

| Item | Verified result |
| --- | --- |
| Source | [Implementation PR #5](https://github.com/gitmaximilian/Foliquo/pull/5) is merged. Both annotated tags resolve to release commit `e4d9ad87baa2397e1d7cc221f76b17b4e3b78a0b`. Public `main` is `093ab9b063a35318b118917e6658132a2becff52`, whose only change after the release commit is `docs/DISTRIBUTION-VALIDATION.md` from PR #6. |
| Stable release | [v0.11.11](https://github.com/gitmaximilian/Foliquo/releases/tag/v0.11.11) is public, `draft=false`, `prerelease=false`, with 7 uploaded assets. All 6 non-manifest assets are covered by SHA256SUMS, including the four platform packages, packaging metadata and Windows signature report. [Exact release-commit workflow](https://github.com/gitmaximilian/Foliquo/actions/runs/40975091139) passed all native builds, both Homebrew jobs, official WinGet validation and publication. |
| Desktop release | [desktop-v0.11.11](https://github.com/gitmaximilian/Foliquo/releases/tag/desktop-v0.11.11) is public, `draft=false`, `prerelease=false`, with 18 uploaded assets. All 17 non-manifest assets match SHA256SUMS and GitHub's asset digests. Windows installer, both Mac architectures and Linux Flatpak are present. [Exact release-commit workflow](https://github.com/gitmaximilian/Foliquo/actions/runs/40978478921) passed all four builds and publication; all four build reports identify the release commit. |
| Updater | Public `latest.json` declares 0.11.11 and the expected Windows, Apple Silicon and Intel URLs; its three signature values equal the published signature files. [Updater validation](https://github.com/gitmaximilian/Foliquo/actions/runs/40973120581) passed on all three platforms for source commit `6858507b049f9e8b262dd5f1624afa70a74ea681`. Its Git tree equals the release merge commit's tree (`d12d6df2c351546bdaaf1c946c74f4daf9628b8a`). |
| Homebrew | The public formula points to 0.11.11 with ARM64/Intel hashes matching the Stable release. [Formula PR #2](https://github.com/gitmaximilian/homebrew-tap/pull/2) is merged; [public tap CI](https://github.com/gitmaximilian/homebrew-tap/actions/runs/40978169954) passed native ARM64 and Intel jobs. No duplicate tap update was needed. |
| WinGet | [Microsoft PR #462448](https://github.com/microsoft/winget-pkgs/pull/462448) is open with 0.11.11 manifests. Official manifest validation passed, but the latest [published install/uninstall acceptance attempt](https://github.com/gitmaximilian/Foliquo/actions/runs/40977478794) failed after the bounded installation wait. Full WinGet installation is unverified; moderator review/indexing remain pending. No public Foliquo WinGet install command is advertised. No duplicate submission was made. |
| Website | The release owner published the canonical Cloudflare Direct Upload source as production deployment `86d0aff3-3929-4b5f-8547-879c2be033de`. This follow-up independently verified English/German 0.11.11 rendering, all five desktop download links, the Stable link and versioned install guide. Apex, WWW, project pages.dev and deployment-specific pages.dev returned matching canonical HTML over normal verified HTTPS; production JavaScript also matches the canonical source. |

## Checksum method and signing boundary

Both public checksum files, all four Desktop build reports, three updater signature files, updater JSON and the Windows signature report were downloaded over verified HTTPS. Their bytes/lengths match GitHub's published SHA-256 digests. Every manifest entry matches its asset's GitHub SHA-256 digest, and every non-manifest asset is covered. The large application binaries were not downloaded a second time during this follow-up; binary integrity evidence combines the release workflow's package verification with the published manifest and GitHub digests.

`windows-signature.json` says `authenticode: NotSigned`. All four Desktop reports say `OS code signature: no`; Windows and Mac updater signatures are present, but they do not provide Windows Authenticode, Apple Developer ID signing or notarization. macOS is not notarized, the unsigned MSIX is only a Store-intake candidate, and Linux is a local Flatpak bundle rather than a Flathub listing. Physical clean-account/SmartScreen/Gatekeeper interaction and an actual historical-version GUI upgrade were not repeated in this follow-up. Successful CI and checksums do not remove those limits.

## Canonical website and sizes

The canonical source is `/Users/maximilianauer/Documents/ChatGPT/website maximilianauer.at/portfolio/dist/`, documented by the project's README, PUBLISHING.md and deployment.json. No dated backup or archive copy was edited. The old 0.11.7 hint is absent from the published project page. Actual uploaded Apple Silicon asset sizes are **636,927,430 bytes (607 MiB rounded)** for DMG and **482,306,324 bytes (460 MiB rounded)** for ZIP. The website's labels agree. Existing Community/license and local-architecture text remains intact.

Live page: https://maximilianauer.at/projects/foliquo/?lang=de#install

## Prepared comparison and open limits

[TRANSLATOR-ACCEPTANCE.md](TRANSLATOR-ACCEPTANCE.md) and [evaluation/](evaluation/) contain 30 reserved independent-document slots, 60 balanced draft sessions for four qualified translators, variants for 3–5 participants, blinded scoring/defect templates and explicit pre-run approvals. They are prepared, not collected or measured data. The proposed published comparison pair is Desktop 0.11.10 versus 0.11.11; OS/package hashes and the study configuration must still be frozen before sessions.

No actual recruitment, document collection, live provider/account-limit testing, or measured translation-quality improvement is claimed. Microsoft's WinGet review/indexing and full install/uninstall acceptance remain open external/installation items. No further build or provider run was started to hide these limits. Community edition, existing license and loopback/local architecture are unchanged.
