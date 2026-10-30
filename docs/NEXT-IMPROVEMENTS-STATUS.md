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
| P00 | automated-verified | Baseline commit `1bbf22f`; dependencies installed with `npm ci --ignore-scripts` | None | `npm test` 183/183; `npm run benchmark` 3 offline cases, 0 regressions; `npm run acceptance` passed; `npm run demo:build` passed | Baseline quality evidence is only the existing offline smoke set, not a human language assessment. |
| P01 | automated-verified | Commit `978e296`; safe `matchedLineCount`/`structure` contract | None | `npm run test:browser` Chromium 1/1 across EN/DE/AR; asserts no private sample text; `npm test` 183/183 | Browser test exercises the actual workflow renderer with a fictional safe-contract response. Expand to full review/job flows under P05. |
| P02 | implementing | Encrypted per-object storage primitive is being introduced; not connected to workspace/job persistence yet | No existing workspace is migrated or rewritten by this primitive | `node --test tests/secure-store.test.mjs`: 2 passed | Integrate it into workspace persistence and streaming reads only after migration, crash recovery, cross-platform atomic replace, and large-data tests exist. Existing 256 MiB store limit remains. |
| P03–P15 | planned | See private handoff plan | None yet | None | Implement in dependency order; distinguish code, automated evidence, and external evidence. |

## Evidence ledger

| Evidence type | Status |
|---|---|
| Automated tests | `npm test`: 183 passed, 0 failed. `npm run benchmark`: 3 offline reference cases, 0 regressions. `npm run acceptance`: passed. `npm run demo:build`: passed. |
| Browser integration | Playwright 1.64.1 pinned in the lockfile; Chromium reference-rendering test passed in EN/DE/AR. Full app-flow matrix remains pending P05. |
| Live provider/quality evaluation | Not run; requires an explicitly bounded live evaluation and suitable human gold-standard review. |
| Human usability / qualified translation review | Not performed. |
| Apple / Windows OS signing credentials | Not checked or claimed. |
| Release | No release requested or created by this implementation log. |
