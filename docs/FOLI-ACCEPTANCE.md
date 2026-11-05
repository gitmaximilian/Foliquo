# Foli release acceptance audit

Scope: the complete F01–F08 plan dated 4 November 2026. This audit tracks the feature-bearing 0.13.0 candidate. It is not a release-completion declaration. WinGet submission, operating-system signing/notarization and Cloudflare are excluded.

| Requirement | Authoritative evidence | Current finding |
| --- | --- | --- |
| F01: one library, data paths, old contracts, original exports and review boundary | `FOLI-IMPLEMENTATION.md`, `context.mjs`, `personal-rules.mjs`, repository AGENTS | Implemented; no user document workspace used for testing |
| F02: typed effects, bounded scope, origins, states, versions and fixed product constraints | `personal-rules.test.mjs`, `sample-rules.test.mjs`, strict model parsing tests | Verified locally |
| Durable approval, idempotent retry, stale rejection and atomic batch/write rollback | `personal-rules.test.mjs`, `rule-api.test.mjs`, `foli-chat.test.mjs` | Verified locally, including injected write failures |
| Old schema/key/profile migration and safe incompatible downgrade | `personal-rules.test.mjs`, workspace schema/migration tests | Verified with fictional encrypted old-schema fixtures and real 0.12.0 → 0.12.99 → 0.13.0 Windows installation in run `41941280478` |
| Bounded encrypted conversation records outside metadata; owner/session checks | `conversation-store.test.mjs`, `foli-chat.test.mjs` | Verified locally, including restart and damaged-record isolation |
| Backup/restore rules, profiles and chat, optional chat exclusion, independent deletion | Conversation/workspace tests and `backup-stream.spec.mjs` | Verified locally; three-engine exclusion/restore flow passes |
| F03: shared selection, sparse layout changes and no source-origin priority | `rule-resolver.test.mjs`, `rule-context.test.mjs` | Verified locally |
| Specific scopes, explicit job exceptions and equal-priority conflicts | Resolver/context/API tests and rule browser workflows | Verified locally; no last-write or majority choice |
| All matching enabled sample profiles; permanent inactive state survives later evidence | `sample-proposals.test.mjs`, four-sample context case | Verified locally; legacy schema-1 hint limit remains compatible |
| Existing glossary is authoritative; blocked terms are not reported applied or sent | Glossary/context tests and strengthened workspace conflict HTTP case | Verified locally, including exclusion of the nonselected pair |
| F04: manual create/edit/duplicate/switch/delete, filter/page, selected approval and shared cards | `personal-rules.spec.mjs`, `rule-api.test.mjs` | Verified across browsers; uncommon scope edit/restart additionally checked |
| Next-job overview, pending scope count and one-job vs permanent exceptions | Rule-management browser/API/resolver checks | Verified locally with no provider requests |
| EN/DE/AR, RTL, keyboard/focus and safe text rendering | Foli/rules/sample/reapplication browser workflows; inspected mobile PNGs | Verified locally; no executable model HTML |
| F05: immutable job rule selection through sections/questions/revision/continuation | Context and segmented runtime/revision tests | Verified locally; later global wording stays out of resumed sections |
| Real Word spacing and PDF export path with original annex | `verify-rule-export.mjs`, `rule-context.test.mjs`, inspected four PDF page PNGs | Verified locally; Word spacing 240/360/432; actual PDF font substitution documented |
| Explicit new-rule revision, unchanged old result, acceptance and restoration | Rule-application unit/HTTP/browser tests | Verified locally; local layout candidates make no provider request |
| F06: existing provider/model/auth, one bounded call per explicit message, no automatic documents | `foli-chat.mjs`, Foli HTTP/browser tests | Verified locally with provider mocks and actual shared accounting |
| Model replies only create validated drafts; no approval or action from model text | Strict parser and atomic conversation/proposal tests | Verified locally, including unsupported effects and target versions |
| Setup/error states, budget and unknown-estimate consent, actual usage/limits | Foli HTTP budget case, browser cancellation/error checks, usage tests | Verified locally; unknown quota/cost is not fabricated |
| Explicit cancellation/uncertain retry, no restart resend and retained drafts | Conversation/Foli/revision tests | Verified locally |
| F07: measured Word before PDF estimates; observations, source/method/pages and unsupported limits | Learning-analysis/sample-proposal/finished-output tests; sample UI | Verified locally; no professional-correctness guarantee |
| Privacy/instruction safeguards and no invented monolingual term mapping | Sample sanitization/candidate tests, typed effects and prompt constraints | Bounded safeguards verified; complete semantic/private-data detection is not claimed |
| Shared sample/chat/manual rules and glossary pairs; duplicate evidence links | Sample/proposal/terminology tests and browser workflows | Verified locally; no hidden second instruction list |
| Legacy approved/rejected profiles migrate without fresh provider analysis | Sample/schema tests and legacy profile-edit browser test | Verified locally and by the real two-step Windows installer migration in run `41941280478` |
| Source switching/removal, explicit independent/deactivate choice and minimal provenance | Source-removal HTTP/unit/browser tests, write-failure checks | Verified locally; current source payload removed and frozen jobs retained |
| Finished-translation learning is optional and analyzes actual target Word | `learning-finished-output.test.mjs`, onboarding opt-in browser case | Verified locally; no extra provider call for rule acceptance |
| F08: required repository gates | PR run `41941274769` at `5582c7c`: Linux/macOS 412/412; Windows 411 passed, one platform skip, zero failures; benchmark 3/3, acceptance 12/12 and demo per OS | Passed on Linux, macOS and Windows; final tagged package gates still required |
| Complete browser catalog | 65/66 initial cases plus repaired teardown and passing Firefox retry | All product cases verified; subsequent backup/scope changes pass focused checks |
| Real public 0.12.0 → intermediate → final Windows installer upgrade | Extended `smoke-desktop-window.mjs`, signed intermediate build and JSON report | Passed in run `41941280478`: exact approved rule/chat versions, legacy profile/approval/source, preferences, usage, budget and key retained; first step replaces an orphan service |
| Mac/Linux packaged runtime, data paths and retained state | Extended `smoke-desktop.mjs` and locally passing fixture contract test | Both macOS architectures and Linux passed in native run `41941280478` at `5582c7c`, including fictional PDF export, encrypted retained state/data paths/key and zero provider requests |
| Stable version metadata, package checksums, updater signatures and manifest targets | Version helper, existing source/desktop release gates and reports | Metadata consistent at 0.13.0; native candidate signatures verified. Final tagged artifacts still required |
| Public source/desktop releases, latest updater feed and Homebrew | GitHub draft/public states, final downloads and tap checks | Pending; no new public release yet |
| User documentation and truthful limits | `PERSONAL-RULES.md`, `RELEASE-0.13.0.md`, README and localized help | Written; exact final gate/release evidence must be added after execution |

The implementation ledger records exact checkpoints and failures/fixes. Before publishing, replace pending findings with inspected run/artifact evidence and recheck that the two public release tags identify the verified candidate commit. A green narrow test does not prove an unexecuted installer or platform path.
