# Community post-release follow-ups

Status recorded on October 29, 2026: **the 0.11.11 release procedure is still in progress in a separate release task.** This report does not declare that candidate published or approved. Do not dispatch duplicate Stable/Desktop builds from this follow-up task.

## Completion checks after the release task finishes

| Item | Required evidence / remaining action |
| --- | --- |
| Source | Confirm the reviewed implementation is on the intended public branch/main and that the Stable and Desktop tags resolve to the reviewed release commit. Preserve all local changes; never move existing tags or overwrite release assets. |
| Stable release | Public regular release, all mandatory platform assets uploaded, successful tag-release gates, SHA256SUMS matching asset hashes and the signature-status report. |
| Desktop release | Public regular release, Windows installer, both macOS architectures and Linux Flatpak, matching checksums/build reports/source commit, and consistent updater manifest/signatures. Distinguish updater verification from OS code signing/notarization. |
| Homebrew | Check the public tap independently. If stale, use only the verified generated formula and public artifact hashes; review native tap checks before merging. At the initial inspection the tap was on 0.11.10. |
| WinGet | Check submission, review, merge and index state independently. At the initial inspection PR #462448 was open for 0.11.10; full WinGet installation acceptance was explicitly unverified. Do not advertise a public install command before actual availability. |
| Website | Update only after actual Stable/Desktop publication. Use the canonical Direct Upload source described below; derive version, filenames and any size labels from the published assets. Verify the production deployment and English/German links. |
| User comparison | Prepared in [TRANSLATOR-ACCEPTANCE.md](TRANSLATOR-ACCEPTANCE.md): 30 reserved independent-document slots, 60 draft sessions for four reviewers, 3–5 participant variants and empty scoring sheets. No recruitment, document collection, provider calls or measured quality gain. |

## Canonical website provenance

The website project is `/Users/maximilianauer/Documents/ChatGPT/website maximilianauer.at/portfolio`. Its README and PUBLISHING.md identify `dist/` as the direct deployment source (no build step), and `deployment.json` identifies the existing Cloudflare Pages Direct Upload project `maximilianauer`. Dated `before-*` directories, `previous-design/` and ZIP archives are backups and must not be edited as the source.

The authenticated original Codex in-app browser successfully opened the documented Cloudflare project. Its production deployment `36f9c1ca-7ba0-42ae-b327-44ecfcbe1653` matches the metadata. The public English project page currently renders **Desktop apps · 0.11.7** with 0.11.7 download/guide links. The local canonical source already contains unpublished 0.11.10 download edits; preserve these and all other existing files before a scoped update. No website deployment has been performed by this follow-up task yet.

Publish only the contents of canonical `dist/` to the existing project. Preserve `_headers`, `_redirects`, all existing site assets and the Community/license wording. Verify apex, WWW and pages.dev over normal HTTPS, the target release/assets and the install-guide link. Save the deployment identifier and actual result, including unsigned/notarized status and any unexecuted manual checks. No hosting/DNS migration is required.

## Evidence boundary

Automated checks, checksum matches and fictional exports are not a measured real-user comparison. A prepared corpus slot is not an independent document already tested. Live provider reliability, account limits and real-world cost checks remain unperformed unless separately approved and recorded. Keep the Community edition, existing license and local architecture unchanged.
