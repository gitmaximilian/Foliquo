# Community workflow release acceptance

Candidate: **0.14.1**. Scope: all 17 accepted items from the 5 November 2026 plan. This audit separates feature evidence from the still-required installed/package/publication gates. It is not a release completion declaration.

## Feature scope

| Item | Implemented outcome | Evidence inspected |
| --- | --- | --- |
| U1 | Compact sample summaries with explicit proposal review | Learning UI, `sample-rules.spec.mjs`, P01 ledger |
| U2 | Foli chat with reachable composer and retained reading position | `foli-chat.spec.mjs`, Foli HTTP/storage checks, P02 ledger |
| U3 | Compact rules with scope, origin, switch and expandable details | `personal-rules.spec.mjs`, rule API checks |
| U4 | Selected tabs and active/inactive states agree with content | Rule/sample browser cases and common state styles |
| U5 | Local before/after examples use actual layout/export effects | `rule-preview.test.mjs`, sample browser flow, actual Word spacing evidence |
| U6 | Rule approval and source activation remain separate saved decisions | Sample-rule/source-operation tests and activation browser case |
| U7 | Consistent localized controls, languages and number formatting | EN/DE/AR cases; shared i18n and source-viewer labels |
| U9 | Saved versions explain their own applied rules/exceptions | `rule-context.test.mjs`, `rule-application.test.mjs`, review guide and frozen trace checks |
| U10 | Common dialogs, controls, keyboard focus and narrow layouts | Shared dialog/source-viewer code; desktop/mobile/RTL browser evidence |
| G2 | Version-bound source coverage with documented original locations | `source-inventory.test.mjs`, geometry tests and source-review browser flow |
| G3 | Critical names/dates/numbers are reviewed before ordinary issues | Risk/review/protection checks and common review guide |
| G4 | Supported columns, long tables/rows and separate blocks share Word/PDF rendering | `document-layout.test.mjs`, `check-document-layout.mjs`, actual exports and inspected PNGs |
| G5 | Explicit dossier document/person/fact relationships retain provenance | `dossiers.test.mjs`, dossier browser cases and backup/restart evidence |
| G6 | Bounded local page scan hints and reversible working-copy corrections | `scans.test.mjs`, scan browser case, actual failed/cancelled page fixtures |
| G7 | Unified next-open-point/final-review flow stays tied to the result version | Review/risk/source checks, review guide and final-download browser cases |
| G8 | Conservative grouping proposals require explicit confirmed start and stable retry identities | Batch unit/API/browser cases, actual split Word/PDF originals and restart checks |
| G9 | Encrypted bounded content search opens current/historical saved text and proven original locations | Search core/API/recovery/provenance/browser checks, actual encrypted restore and 1,001-record profile |

All feature rows have focused acceptance evidence. The corrected 0.14.1 local integrated suite passes **478/478**, including the legacy-source review regression and installed-fixture contract. The source/review/upgrade subset passes 28/28. Platform pipelines must repeat the full suite on this candidate. The first integrated run exposed four problems: common shape-token drift, an optional browser extension reference in the extracted preview renderer, and two Word assertions that assumed no additional paragraph properties. Shared tokens and the guarded extension call were fixed; Word tests now check the exact relevant paragraph/gap spacing rather than property serialization adjacency. The targeted follow-up and complete rerun pass.

Actual current export inspection covers LTR/RTL columns, long-table continuation and an oversized row. Text is retained, repeat headers/continuations remain legible, and the original annex is still verified. Font substitution is reported rather than hidden. The original-byte/Word-structure checks cover all seven small layout fixtures; no new linguistic study is claimed.

## Invariants and limits

Originals, original-page annexes, encrypted keys/data, provider accounting, budgets, owner/CSRF checks, loopback binding and explicit human review remain required. New navigation/management/search/scan/grouping does not add model calls. Existing source/CLI and Tauri paths remain available. No Electron/PWA or external search service was introduced.

Source inventories, OCR, handwriting, scan metrics and reconstructed layouts retain their documented uncertainty. Content search discloses incomplete source text, unknown positions, partial indexing and technical limits; numeric glyphs are not equated. Exact bounds, memory measurements and scenario-qualified timings are in `CONTENT-SEARCH.md`. Fictional fixtures only were used.

Excluded: U8 extra Foli accounting display; G1 independent professional linguistic study; G10 reviewed starter profiles; WinGet submission; operating-system signing/notarization; Cloudflare deployment.

## Release gates

| Gate | Current authoritative status |
| --- | --- |
| Version and release-note consistency | 0.14.1 metadata helper/check passes; no existing tag reused |
| Local `npm test` | Passed on 0.14.1: 478 tests, zero failures |
| Local benchmark | Passed; offline fictional cases, zero model requests/regressions |
| Local acceptance/export command | Passed on 0.14.1; all four installation/test/benchmark/structured-export steps pass |
| Local demo build | Passed on 0.14.1 in EN/DE/AR with fictional downloads |
| Locked production dependency audit | Passed: no high-severity production finding |
| Search archive duration/peak RSS | Passed; 1,001 fictional records including 20 MiB text, bounded pages/steps and predeclared memory budgets |
| Search browser acceptance | Chromium/WebKit passed; EN/DE/AR, keyboard, dark/mobile, original/version checks |
| Installed-upgrade fixture contract | Local encrypted/API/restart contract passes with rules, chat messages, dossier/fact/job, confirmed source/check/final decisions and paused search |
| Real installed public 0.13.0 upgrade | Passed: real public 0.13.0 → unpublished 0.13.99 → 0.14.1; native Windows job 130021516287 |
| Native Mac/Windows/Linux packages and bundled runtime/data paths | All four platform builds and bundled service/persistence/signature gates passed; final desktop draft download audit pending |
| Source packages and actual package-manager install checks | All four source packages passed; real Homebrew audit/install/test/reinstall/uninstall passed on ARM and Intel; six downloaded source assets match SHA256SUMS |
| Updater signatures, manifest versions/URLs and complete checksums | Platform signature gates passed against unchanged public keys; final desktop draft/manifest/download audit pending |
| Public desktop/source releases and current update feed | Source is a verified unpublished draft; desktop draft staging is in progress; public latest remains 0.13.0 |
| Homebrew publication and public-asset verification | Not published |

The installed baseline is downloaded from the existing public `desktop-v0.13.0` release, checked against SHA-256 `8eacccae4c74a99425e296b7284c0261c59f62f4cdfb8d8d8997518333cf835c` and its updater signature. Full fictional workflow records are seeded using that installed runtime's own modules before its first launch, then checked before/after both upgrade steps. Search is enabled/paused in the intermediate candidate and must survive the final update. This describes the prepared gate, not an already completed native result.

Ignored raw evidence remains in `outputs/workflow-*`. Platform run IDs, package manifests, installed-upgrade JSON reports and final publication checks must be added here before marking the goal complete.

The 0.13.0 source-review format has no binding digest. A read-only compatibility path now establishes one only from the same saved result version or an unchanged frozen snapshot. Missing/changed evidence still reopens review. The upgrade fixture deliberately retains this legacy format even when exercised with current modules, preventing a current-only fixture from hiding an installed migration failure.

## Candidate correction before publication

The immutable 0.14.0 tags reached the platform gates but were not published. Full platform tests caught a legacy-source fixture that must remain unreviewed: result version 1 cannot contain a human source decision because the old operation increments the version. Candidate 0.14.1 accepts an unbound legacy decision only from version 2 or later, with an allowed action and a matching current/frozen version; mapped decisions additionally require the actual saved reverse node links. The review read does not mutate saved records. The corrected source/review/installed-fixture set passes 28/28 locally. The browser sweep passed 51/52; the remaining proposal-edit case clicked its replaced draft before refresh. After waiting for the changed draft ID/text, that case passes in both Chromium and WebKit (2/2); its assertions and the product version guard are retained. The obsolete source run was cancelled after its other three jobs failed; no native package/public release was produced. Final local integrated checks on 0.14.1 pass: 478 tests, benchmark, demo build and all four acceptance steps. Platform/installed/package/publication gates remain pending.

## Platform evidence before publication

The exact release commit is `8a0def6e3c18263492a661fcc902ef2bd615e00f` (`v0.14.1`, `desktop-v0.14.1`). [Source distribution run 42870037207](https://github.com/gitmaximilian/Foliquo/actions/runs/42870037207) passed all four builds, metadata, both real native Homebrew checks and existing local package-manifest validation. Downloaded source assets verify all six SHA256SUMS entries; the three archive manifests announce the intended 0.14.1 platform/architecture and the Homebrew formula contains the actual ARM/Intel archive hashes. No WinGet submission occurred.

[Main integration run 42871087724](https://github.com/gitmaximilian/Foliquo/actions/runs/42871087724) passes on Linux, macOS and Windows, including first-use setup, all 478 tests, archive/backup/recovery memory budgets, near-cap 255 MiB legacy restore, genuine isolated full-volume atomic-replacement checks, and mandatory benchmark/demo/acceptance. The real ENOSPC checks preserve the previous object and leave no temporary objects on ext4, APFS and NTFS. These are fictional technical checks, not linguistic evidence.

[Desktop run 42870036330](https://github.com/gitmaximilian/Foliquo/actions/runs/42870036330) has passed prechecks and all four native build jobs: ARM 130021516354, Intel 130021516311, Linux 130021516379 and Windows 130021516287. Each bundled runtime exports a fictional PDF and verifies encrypted rules, chats, profiles, budget, key, data paths, workflow state and search setup. ARM/Intel updater signatures verify. Windows additionally verifies the public baseline signature, intermediate signature and final signature, renders the actual 0.13.0 native workspace, then performs two real installer upgrades.

Both Windows upgrade steps retain the same workspace key, source bytes, legacy profile, preferences, budget, usage, pre-existing independent rule, Foli messages, dossier/fact/job IDs, version-2 source/check/final decisions and frozen rule context. The first step replaces the deliberately orphaned old service; the intermediate step enables/pauses search. The final step retains that completed paused index and its result version, plus an additional rule and chat created on the intermediate runtime. The report records zero provider requests. The actual report will also be included as `UPGRADE-REPORT-Windows-x64.json` in the desktop assets.

Final downloaded desktop checksum/signature/manifest checks, source/desktop publication, public feed verification, main integration and Homebrew publication/public-asset checks remain open. All releases are still unpublished at this checkpoint.
