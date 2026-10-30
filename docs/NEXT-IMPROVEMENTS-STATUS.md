# Foliquo Community Improvements: Implementation Status

This document tracks implementation separately from automated verification and external evidence. The detailed scope and acceptance criteria are in the private handoff plan dated 30 October 2026.

## Baseline

- Starting commit: `1bbf22f` (`docs: record v0.11.11 distribution verification`).
- Starting branch: `codex/release-validation-0.11.11`, tracking the matching origin branch.
- Initial worktree: clean; no pre-existing user changes.
- Repository instructions: Node.js 22+, loopback-only service, browser/CLI and Tauri retained, English repository documentation, fictional test data, preserve PDF/Word behavior and human-review boundary.
- Baseline defect confirmed by source inspection: `lib/memory.mjs` exposes `matchedLineCount` and deliberately withholds private example text; `dist/workflow.js` dereferenced `ref.matches` and rendered `ref.translation`.
- Baseline storage risk confirmed by source inspection: successful queue entries can have results evicted and marked `expired` over the 160 MiB in-memory threshold; workspace persistence remains one encrypted JSON file capped at 256 MiB.
- No customer documents or personal workspace data were used.

## Package tracking

| Package | Status | Commit / evidence | Data impact | Tests run | Limitations / next action |
|---|---|---|---|---|---|
| P00 | automated-verified | Baseline commit `1bbf22f`; dependencies installed with `npm ci --ignore-scripts` | None | Latest `npm test`: 200/200; `npm run benchmark`: 3 offline cases, 0 regressions; `npm run acceptance`: 11/11; `npm run demo:build`: passed | Baseline quality evidence is only the existing offline smoke set, not a human language assessment. |
| P01 | automated-verified | Commit `978e296`; safe `matchedLineCount`/`structure` contract | None | `npm run test:browser` Chromium 1/1 across EN/DE/AR; asserts no private sample text; current full repository suite: 199/199 | Browser test exercises the actual workflow renderer with a fictional safe-contract response. Expand to full review/job flows under P05. |
| P02 | implementing | Commits `1354a47`, `6e3b035`, and `3799c33` provide authenticated AES-256-GCM writes, metadata binding, atomic replacement, interruption safety, and staged decryption. Commit `e2b6c8c` connects `JobStore` to `Workspace.save/init`, adds schema 4, moves job records out of the bounded metadata file, fingerprints records to avoid rewriting unchanged jobs, atomically publishes changed/deleted records through a verified index, and backs up schema 1–3 `workspace.enc` files before migration. Commit `a59b917` removes deletion caused solely by the 1,000-job count cap. Commit `fa4d225` adds owner-scoped, newest-first, paginated summary reads in `JobStore` and `/api/job-summaries`. | Migration is exercised only with fictional jobs in temporary workspace directories. Existing workspaces are not touched. The old encrypted file remains as a local pre-schema-4 recovery copy. | `tests/job-store.test.mjs`: 5/5; `tests/workspace.test.mjs`: 18/18; `tests/queue.test.mjs`: 9/9; `tests/integration.test.mjs` plus job-store tests: 19/19; latest full `npm test`: 200/200; `npm run benchmark`: 3 offline cases, 0 regressions; `npm run acceptance`: 11/11; `npm run demo:build`: passed and generated demo assets were restored. | The queue and Workspace still hydrate every historical job into memory; neither the current UI nor queue snapshot consumes the paginated endpoint yet. Lazy record loading, result-cache eviction and streamed downloads remain unfinished. Backup format and its 256 MiB limit remain monolithic. No 100-job/>1 GiB test, crash-point matrix, ENOSPC test, or Windows/Linux migration run yet. |
| P03–P04, P07–P12, P15 | planned | See private handoff plan | None yet | None | Implement in dependency order; distinguish code, automated evidence, and external evidence. |
| P05 | implementing | Playwright harness and `tests/browser/references.spec.mjs` added in `978e296`; browser test covers 375/1024/1440 px and EN/DE/AR/RTL reference rendering | Isolated temporary workspace and fictional reference data | Latest `npm run test:browser`: Chromium 1/1 passed | Expand to the plan's complete translate/review/export/backup/restore flows and add WebKit/Firefox before calling P05 complete. |
| P13 | implementing | Commit `85e6bad` places personal style samples before optional private case dossiers | No data change; existing dossiers and samples remain in place | Chromium browser smoke confirms ordering at the rendered workspace view, 1/1; current full repository suite: 199/199 | Complete onboarding language, accessibility, and broader keyboard/user testing from the plan. |
| P06 | implementing | Commit `a49f0cc`; `benchmarks/README.md` documents current evidence limits; benchmark reports include source revision, fixture-set label, provider/model, request count, and explicit live case cap | Only existing fictional fixtures used; no external or customer data | `tests/benchmark-cli.test.mjs`: 2 passed; `npm run benchmark`: 3 offline cases, 0 regressions; `npm test`: 191/191 | Three smoke fixtures remain; build held-out 20/100 collection and independent human rating protocol without claiming quality. |
| P14 | implementing | Commit `c3d5715` fixes stale desktop-guide links. Commit `8dab583` adds per-artifact macOS codesign/Gatekeeper/stapler checks, Windows Authenticode checks, explicit mixed/rejected/unverified outcomes, and machine-readable `BUILD-REPORT.json`; the report also distinguishes the build target from the host that ran verification. `docs/DESKTOP-APPS.md` documents status meanings. | No user data touched. A temporary fictional package is used by the report integration test. | `tests/desktop-signatures.test.mjs` and `tests/finalize-desktop.test.mjs`: 5/5 passed; full `npm test`: 200/200; `npm run benchmark`: 3 offline cases, 0 regressions; `npm run acceptance`: 11/11; `npm run demo:build`: passed and generated demo assets were restored. | Platform commands are tested with mocked verifier responses plus a local report-generation integration test. No signed release artifacts, Apple notarization, Windows certificate, fresh-install test, or older-to-newer upgrade was verified. External identities remain unavailable/unverified. |

## Evidence ledger

| Evidence type | Status |
|---|---|
| Automated tests | Latest full `npm test`: 200 passed, 0 failed. Targeted desktop-signature/report tests: 5 passed, 0 failed. Current P02 JobStore/workspace/queue suites: 32 passed, 0 failed; paginated API and storage suites: 19 passed, 0 failed. `npm run benchmark`: 3 offline reference cases, 0 regressions. `npm run acceptance`: 11 passed, 0 failed. `npm run demo:build`: passed; generated demo assets restored afterward. |
| Browser integration | Playwright 1.64.1 pinned in the lockfile; Chromium reference-rendering and learning-order test passed in EN/DE/AR. Full app-flow matrix remains pending P05. |
| Live provider/quality evaluation | Not run; requires an explicitly bounded live evaluation and suitable human gold-standard review. |
| Human usability / qualified translation review | Not performed. |
| Apple / Windows OS signing credentials | Not checked or claimed. |
| Release | No release requested or created by this implementation log. |
