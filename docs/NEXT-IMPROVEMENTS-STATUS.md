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
| P00 | automated-verified | Baseline commit `1bbf22f`; dependencies installed with `npm ci --ignore-scripts` | None | Latest `npm test`: 191/191; `npm run benchmark` 3 offline cases, 0 regressions; `npm run acceptance` passed (11/11); `npm run demo:build` passed | Baseline quality evidence is only the existing offline smoke set, not a human language assessment. |
| P01 | automated-verified | Commit `978e296`; safe `matchedLineCount`/`structure` contract | None | `npm run test:browser` Chromium 1/1 across EN/DE/AR; asserts no private sample text; latest `npm test` 191/191 | Browser test exercises the actual workflow renderer with a fictional safe-contract response. Expand to full review/job flows under P05. |
| P02 | implementing | Commits `1354a47`, `6e3b035`, and `3799c33` provide authenticated AES-256-GCM writes, metadata binding, atomic replacement, interruption safety, and staged decryption; `lib/job-store.mjs` adds versioned encrypted records, summaries, and a verified migration API. Neither component is connected to workspace/job persistence yet | No existing workspace is migrated or rewritten | `tests/secure-store.test.mjs`: 4 passed; `tests/job-store.test.mjs`: 3 passed; latest `npm test`: 191/191 | Integrate with Workspace and Queue, including backward-compatible migration and lazy loading; test real large archives, process crashes, and supported platforms. Existing 256 MiB workspace limit remains. |
| P03–P04, P07–P12, P15 | planned | See private handoff plan | None yet | None | Implement in dependency order; distinguish code, automated evidence, and external evidence. |
| P05 | implementing | Playwright harness and `tests/browser/references.spec.mjs` added in `978e296`; browser test covers 375/1024/1440 px and EN/DE/AR/RTL reference rendering | Isolated temporary workspace and fictional reference data | Latest `npm run test:browser`: Chromium 1/1 passed | Expand to the plan's complete translate/review/export/backup/restore flows and add WebKit/Firefox before calling P05 complete. |
| P13 | implementing | Commit `85e6bad` places personal style samples before optional private case dossiers | No data change; existing dossiers and samples remain in place | Chromium browser smoke confirms ordering at the rendered workspace view, 1/1; `npm test`: 191/191 | Complete onboarding language, accessibility, and broader keyboard/user testing from the plan. |
| P06 | implementing | Commit `a49f0cc`; `benchmarks/README.md` documents current evidence limits; benchmark reports include source revision, fixture-set label, provider/model, request count, and explicit live case cap | Only existing fictional fixtures used; no external or customer data | `tests/benchmark-cli.test.mjs`: 2 passed; `npm run benchmark`: 3 offline cases, 0 regressions; `npm test`: 191/191 | Three smoke fixtures remain; build held-out 20/100 collection and independent human rating protocol without claiming quality. |
| P14 | implementing | Commit `c3d5715`; `FEATURES.md` now links to the current desktop guide and `docs/DESKTOP-APPS.md` points to `main`; prior preview and branch references removed | None | `tests/desktop-docs.test.mjs`: 1 passed; latest `npm test`: 191/191 | Actual platform signature detection, notarization, fresh-install and upgrade evidence remain outstanding. No external signing identity has been checked or claimed. |

## Evidence ledger

| Evidence type | Status |
|---|---|
| Automated tests | `npm test`: 191 passed, 0 failed. `npm run benchmark`: 3 offline reference cases, 0 regressions. `npm run acceptance`: 11 passed, 0 failed. `npm run demo:build`: passed. |
| Browser integration | Playwright 1.64.1 pinned in the lockfile; Chromium reference-rendering and learning-order test passed in EN/DE/AR. Full app-flow matrix remains pending P05. |
| Live provider/quality evaluation | Not run; requires an explicitly bounded live evaluation and suitable human gold-standard review. |
| Human usability / qualified translation review | Not performed. |
| Apple / Windows OS signing credentials | Not checked or claimed. |
| Release | No release requested or created by this implementation log. |
