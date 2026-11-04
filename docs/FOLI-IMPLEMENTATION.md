# Foli implementation tracking

Baseline: version 0.12.0, clean worktree at `0a4cd28`. Scope is the private Foli implementation plan dated 4 November 2026, including sample-derived rules. WinGet, operating-system signing and Cloudflare are excluded.

## Architecture decisions

- One versioned rule library accepts reviewed proposals from chat, manual input and samples. Origins are evidence, not separate execution paths or implicit priority.
- Rules and bounded proposals live in the encrypted workspace metadata and participate in existing atomic persistence, recovery and backup/restore. Schema 5 prevents older releases from silently dropping new settings. Migration retains existing collections and keys; legacy sample conversion is explicit and versioned.
- Conversations use bounded encrypted records outside metadata; accepted rules do not depend on chat retention. No synthetic translation jobs.
- A shared server-side resolver owns applicability, exclusions, conflicts and explicit layout changes. New job snapshots pin candidate rule versions; legacy snapshots keep their legacy interpretation.
- Typed layout effects reach the existing renderer. Fixed typography and original-page annex invariants remain enforced. Terminology continues through the glossary.
- Model output only proposes changes. Approval uses optimistic versions and idempotent proposal identity; the API must await durable persistence before reporting success and restore in-memory state on failure.

## Work packages

| Package | State | Evidence / next step |
| --- | --- | --- |
| F01 | Inspected | Plan and AGENTS read; storage, schema, learning approval and context/export boundaries inspected. |
| F02 | Implemented; final upgrade gates pending | Bounded typed rules/proposals, explicit approval, optimistic versions, idempotent repeated approval and inactive/deleted-rule preservation implemented. Workspace schema 5, encrypted persistence and both backup formats include the library. |
| F03 | Context integration implemented | New schema-2 context snapshots use the canonical resolver; legacy schema-1 snapshots retain prior behavior. Bound job conflict/scope questions and existing terminology questions are connected. |
| F04 | Rule-management UI implemented; final feature gates pending | Learning tabs, rule filters/edit/duplicate/switch/delete, proposal adjustment and individual/selected approval, and primary-page job overview use the shared API/resolver. Chromium/WebKit focused workflows pass. |
| F05 | Implemented; final distribution gates pending | New rules can create a separate local-layout or metered wording revision proposal. Existing results and restorable versions retain their original contexts. |
| F06 | Chat/provider foundation implemented; final feature acceptance pending | Encrypted bounded history, one metered provider call per turn, explicit typed drafts, shared review cards, cancellation/uncertain retry and existing budget consent are connected. |
| F07 | Canonical sample proposal integration implemented; final acceptance pending | New analyses produce shared typed drafts with measured/estimated origins, review and source/profile controls; legacy migration and opt-in finished-output analysis are retained. |
| F08 | Pending | Historical upgrade, complete feature/browser/platform gates and release. |

No feature completion or release is claimed. Existing 0.12.0 artifacts are unchanged.

### Foundation verification

Targeted local checks passed: 10/10 rule and existing learning-selection cases, followed by 8/8 focused rule/schema migration cases after adding stream backup and write-failure checks. Fictional encrypted schema-4 data migrates with a byte-identical recovery copy and unchanged key/profile/approval state. Rules survive restart, TOCRBACK1 restore and TOCRBACK2 stream restore. Invalid rule writes and injected ENOSPC leave the committed manifest unchanged. Existing schema-1/schema-2 migration checks pass with the current schema constant. No user workspace or live provider was accessed.

Full repository gates, UI, resolver/context integration, sample conversion and release remain pending. The rule API still needs transaction rollback and concurrency integration before exposing mutations.

### Resolver boundary

`rule-resolver.mjs` is a single pure applicability/precedence implementation for the later server API and translation pipeline. Conditions override broader conditions only by containment, rather than arbitrary condition counts. Conflicting incomparable rules do not produce a layout value. Changes stay as sparse layout properties, and fixed typography/annex properties are rejected. Snapshot tests verify profile switches, per-job exceptions and rule versions. It is not yet wired into provider or renderer requests; the existing learning path remains unchanged until canonical sample conversion can replace it without duplication.

### Durable approval transactions

Workspace saves now accept an internal synchronous rule operation, computed against a private library copy inside the existing write queue. The live library changes only after its encrypted manifest commits. Ordinary saves queued during approval preserve the latest committed rule library; failed approval never publishes its draft state. Metadata remains serialized without reparsing large existing sample payloads. Focused transaction checks passed, including a deliberately held write, a concurrent ordinary save and injected EACCES.

This storage checkpoint passed `npm test` 378/378, `npm run benchmark` (3 offline cases, zero regressions/requests), `npm run demo:build` and `npm run acceptance` 12/12 on macOS arm64. Generated tracked demo artifacts were restored after verification. These are technical storage/regression checks, not proof of the still-pending Foli UI, sample conversion or export feature.

### Canonical sample migration

Existing active/previously effective sample settings now synchronize into the canonical rule library during normalization and inside durable workspace saves. Selected style observations, layout properties, field order and approved terminology retain normalized scope and dataless source references. Pending new profiles and rejected observations are not imported. Duplicate sample evidence shares one rule; repeated synchronization is idempotent and never enables an inactive/deleted rule. Pending edits retain their prior approved definitions while their profile stays unavailable for new jobs. Legacy effective profiles without a clear approval marker are labeled `legacy-effective`, rather than inventing a new approval.

The bounded rule capacity now covers all permitted legacy sample collections (60 samples × up to 80 rules, 240 observations, 100 terms, layout and field order), with room for independent rules. Managed sample terminology uses the existing glossary records and a higher bounded schema capacity, but cannot bypass the rule resolver or be silently detached through ordinary glossary editing/deletion. Ordinary manual glossary capacity is unchanged. Source document bytes are excluded from the save-time conversion snapshot.

Focused verification: rule/sample/resolver/glossary tests 20/20, plus existing context/learning matching/layout/feedback/finished-output checks 17/17. The existing provider-mocked finished-output workflow still passes. The translation context still uses the legacy interpretation until the next integration change; no canonical rule is sent in parallel, and the UI/chat/release remain pending. Full gates were last run at the preceding storage checkpoint, not claimed for this migration change.

### Canonical context and real export integration

New jobs freeze schema-2 context libraries and resolve approved manual/sample rules through one path. Ranked sample selection reuses existing feedback ordering without applying a second rule list. Effective instructions, field order, rule IDs and exact versions are retained with results; disabled sample instructions cannot reappear through legacy provider hints. Rule scope and same-rank conflicts are resolved by bound, localized per-job questions before translation, without misleading source/unreadable controls. Source extraction now requests source language within its existing request; unknown required scopes ask rather than silently omit a rule. Old schema-1 snapshots retain their original layout precedence and learning behavior.

Canonical terms use the existing glossary selector with rule activation gating. Language aliases now share one matching/conflict group. Approved rules override template/profile defaults according to the agreed new-plan priority; legacy snapshots keep the prior priority. New sample rule feedback IDs remain eligible for ranking summaries.

Evidence: focused context, learning feedback/layout and segmented translation/review runtime checks passed 20/20, including uncertain retries and restart. Follow-up context/glossary/export checks passed 12/12 after adding alias-conflict and version-trace assertions. The fictional HTTP export test makes exactly one extraction and one translation request, sees each approved wording rule once, verifies actual DOCX `w:line=360` for 1.5 spacing and verifies a multi-page PDF retains its source annex. Independent visual PDF review is still pending. Full repository/browser/platform gates will run at an integrated feature checkpoint; no feature completion or new release is claimed.

### Rule-management API

Added session-protected paginated rule/proposal reads and CSRF-protected proposal, approval/rejection and current-job preview endpoints. Manual origins are assigned server-side. Proposal creation uses a stable per-session request identity; approvals use exact versions and accept idempotent retries. Per-job exclusions/layout overrides enter the same validated metadata and resolver used by translation. No rule-management provider requests are issued.

Sample-derived rules now retain source fingerprints separately from edited effects. A manual edit remains authoritative when the same approved sample synchronizes again, avoiding both recreation of its old value and deterministic-ID collisions. Existing source bindings remain bounded and validated. Explicit edits/enabling are marked approved rather than retaining the legacy-effective label.

Write-queue completion no longer remains rejected after a handled stale/invalid rule operation; the initiating save still rejects with its original error. A stale decision does not masquerade as a disk failure. Focused HTTP/core/sample checks passed 13/13, covering replay, mismatched request IDs, real restart, preview-only exclusion, disable, CSRF refusal, atomic batch rejection, injected disk-full failure and subsequent retry. Views/chat and full feature/release gates remain pending.

### Rule views and next-job overview

Added a Learning → Rules tab alongside the existing sample tools. Rule cards show normalized settings, scope, source, status and change time, with edit, duplicate, permanent activation and confirmed deletion. Filters cover state, category, origin, source/target language and document type; reads remain paginated. Manual edits use typed forms and create an explicit proposal. Proposal cards support accept, discard, adjust and deliberately selected batch approval. Adjusting a proposal atomically supersedes its prior pending version; it never activates a rule. Reviewed proposal history can be cleared with confirmation without deleting accepted rules, so bounded proposal retention does not permanently prevent new work.

The button beside Translate remains available even before file selection. It uses real server resolution, distinguishes effective/pending/nonmatching/inactive/conflicting rules and supports next-job exclusions independently of permanent activation. The existing sample switch is kept separate from independent rules. Successful enqueue clears only temporary rule exceptions. Rule forms/labels are translated in EN/DE/AR, user rule contents are excluded from automatic interface translation, dialogs restore focus, and tabs support keyboard navigation.

Verification: the full manual rule UI flow passed Chromium and WebKit, including explicit approval, one-job exclusion without global mutation, permanent disable, edit while inactive, re-enable, proposal adjustment, selected approval, language filtering, duplicate/discard, localized labels, 375px width, Arabic RTL and reload of the durable rule. Existing learning-profile editing passed in both engines. The expanded rule UI flow then passed 2/2 after its additions. Provider request count stayed zero. A fictional Arabic mobile screenshot was visually inspected. API/sample follow-ups passed 8/8, including atomic supersession/history clearing and no ID collision when a removed sample is replaced after its rule was manually edited.

No new release yet. Foli conversations/provider proposals, deeper sample proposal integration, explicit rule application to old results, visual PDF review, historical upgrade and integrated final gates remain open.


### Encrypted conversation persistence and recovery

Foli conversations now have a bounded metadata index and separate immutable AES-GCM records, owner-scoped under the existing workspace session model. New records publish only after the encrypted manifest commits; failed or stale writes keep the previous conversation. Ordinary concurrent saves retain the latest index. Startup marks unfinished replies as uncertain without replaying provider requests; a damaged chat can be isolated without disabling rules or the workspace. Deleting chat history preserves accepted rules.

Streamed backups include authenticated conversation frames and lease their immutable records during concurrent edits. Restore validates all records, reencrypts under the destination key, remaps the importing owner and commits atomically with jobs and metadata. Recovery points include the chat store. Explicit chat exclusion retains the rule library; the legacy synchronous backup refuses silent history loss.

Evidence: all six conversation-store cases pass, including injected disk-full restore rollback, truncated archive, owner isolation, restart, recovery-point rollback and corrupt-record isolation. A focused combined workspace run passed 12/12 including old schemas, legacy/streamed backups and failed restore persistence. No provider or private documents were used. The chat service and UI remain the next integration step.


### Foli chat and shared proposal review

Added a dedicated Foli navigation/view with bounded encrypted history, new-chat selection, draft retention, cancellation and independent history deletion. It uses the existing provider/model selectors, model catalog and AI settings. Context contains at most 40 relevant rule summaries, specifically referenced pending proposals and 12 recent messages (32,000 characters); documents and previous translations are never attached. One submitted turn invokes at most one provider request, through the existing usage/budget adapter under `foli_chat`. An interrupted or cancelled dispatched request requires deliberate confirmation before a new request; restart never resends it. Stable request IDs replay without another provider call.

Strict provider JSON validation permits only typed proposal operations and known target versions. The reply and its draft IDs publish in the same durable transaction; failed storage or cancellation cannot publish partial drafts. No provider output approves a rule. Unsupported capabilities and new terminology without an existing glossary record are currently explained rather than falsely applied; complete shared terminology proposal integration remains part of F07.

Chat and Learning use the same proposal-card renderer and approval/adjustment APIs. Adjustments retain a bounded supersession reference so the chat card follows the replacement proposal instead of silently losing it. Accepted/discarded state is read from the persisted library. Local management does not call a provider. The server retains session/owner/CSRF protection and blocks backup restore/archive recovery during active Foli work.

Evidence: focused Foli/rule API/model checks passed 14/14. A follow-up real HTTP budget check verifies an unpriced API request is blocked before provider use and the existing explicit one-request consent permits the next intended turn. Browser Foli plus existing rule-management workflows passed 4/4 in Chromium/WebKit: proposal adjustment and acceptance into the same library, no additional provider usage for review, safe text rendering, encrypted-history reload, cancellation/uncertain state, chat deletion without rule loss, EN/DE/AR and 375px RTL. The fictional Arabic mobile screenshot was visually inspected. Broad final gates, F07, explicit old-result rule application, visual PDF review and actual upgrade remain pending; no feature release yet.


### Shared terminology proposal transaction

Foli, manual edits and future sample proposals can now carry a pending glossary pair alongside a typed terminology effect. The server assigns a deterministic, scope-bound glossary ID. The pair is not stored as an effective glossary entry until explicit proposal approval commits both the rule and the managed glossary record in the existing workspace write queue. Rejecting or adjusting a draft does not activate its old pair. Existing glossary selection and per-job rule gating remain authoritative, including global managed rules and scope-bound terms. Ordinary glossary entries retain their language behavior.

The shared editor can create or adjust a new pair, and cards show the actual source/target text before approval. New terms from Foli are no longer deferred to manual entry. Focused rules/chat/glossary checks passed 21/21 before the new transaction cases; two added checks passed for new terminology and strict model parsing. The terminology HTTP case injects disk-full during approval and verifies no partial rule or glossary record, then checks successful restart, per-job exclusion and encrypted backup/restore. Expanded manual UI flow passed Chromium/WebKit, including a new pair, adjustment and approval with zero provider requests. Complete sample proposal generation/review and source removal choices remain open F07 work.


### Canonical sample proposal integration

New sample uploads now use the shared proposal library rather than activating legacy raw profile instructions. At completed analysis, measured DOCX line spacing, uniform margins and supported table/title properties take precedence over model estimates. Distinct chunk layout values remain separate uncertain proposals, without applying the legacy aggregate median. Linguistic observations, supported typed observation effects, field order and sufficiently contextual parallel terminology become individually reviewable drafts. Unverified terminology and unsupported observations remain descriptive. The analysis prompt explicitly separates document data from instructions; local proposal filtering rejects known private values and instruction-like content. This is a bounded safeguard, not an independent guarantee of translation correctness or complete personal-data detection.

Proposal history keeps dataless source/fingerprint tombstones so a rejected proposal does not reappear after history clearing or reanalysis. New substantive effects can produce new proposals; repeated evidence never enables an inactive rule. Accepted duplicates share IDs and merge source-profile links, while independently approved rules remain independent. Capacity is now 1,000 retained proposals, enough for one maximum bounded multi-chunk analysis; reviewed proposals can be cleared without forgetting source rejection history. Full history failures are explicit and resumable, without silently dropping remaining candidates.

Samples show the same proposal cards and selected approval API as manual/Foli rules, including scope, evidence method/pages/version, adjustment, rejection, and a link to discuss an existing proposal with Foli. Accepted rules appear in the single library, whose source buttons return to the sample. The source switch controls approved dependent rules only; approving a draft does not silently turn on its source profile. Existing legacy profile editing retains its prior workflow. Source removal previews affected rule versions and requires a choice for sole-dependent rules: keep independently or deactivate. It preserves minimal provenance and exact inactive states, rejects dependent pending drafts and removes the source payload. Failed deletion persistence retains the current sample and rule state.

The existing voluntary finished-translation offer feeds this same path. A real provider-mocked HTTP run generates and analyzes the finished Word file, produces measured shared drafts, and approves one without any additional provider request. Short language names and short field labels now survive metadata sanitization; layout estimates outside supported ranges are omitted instead of clamped into a fake observation.

Evidence: focused sample/learning/profile checks passed 13/13, followed by shared sample/context/API/encrypted-conversation regression checks 23/23. Added HTTP finished-output/source-removal checks passed 2/2, including injected disk-full rollback. New sample UI and existing legacy-profile editing passed 4/4 across Chromium/WebKit: review, source on/off, source-to-rule navigation, independent retention after source deletion, EN/DE/AR and narrow RTL. The fictional Arabic sample screenshot was visually inspected. These are feature checks, not final all-platform or update acceptance. Explicit new-rule application to old results, visual PDF review, integrated gates and actual upgrades/releases remain open.


Mobile visual follow-up found that the existing learning-card grid could clip long RTL switch labels inside the card even while the page itself reported no horizontal overflow. The sample grid now uses a shrinkable column and wrapping switch text. A targeted Chromium rerun passed an added internal-overflow assertion; the refreshed Arabic screenshot was inspected and the clipping is resolved. Generated sample layout titles use readable setting names rather than internal property keys.


### Explicit application of new rules to completed translations

Added a review action that previews the current approved rule library for an existing result, resolves bound scope/terminology conflicts, and pins that selection before starting work. Later global changes cannot enter the selected revision. Preview and approval are local; only changed wording, field order or effective terminology uses the existing job provider/model, usage accounting, budget checks, cancellation and segmented revision mechanism. Export-only changes rebuild both formats locally. The resulting candidate uses the existing explicit revision acceptance flow, retains protected-field checks and leaves the current result untouched until accepted.

New contexts also retain their pre-rule layout baseline. Reapplication preserves pinned template/profile defaults instead of silently refreshing their global settings, and can continue when an old template was removed. Legacy results without that new baseline keep their available pinned fallback when a selected template is missing. Existing result versions retain their own context and can be restored through the existing version action. Pending rule revisions can be discarded; failed/uncertain segmented requests retain their frozen context and explicit retry gate.

Evidence: focused rule/review/revision checks passed 16/16. The fictional HTTP export workflow now changes spacing 1.5 → 1.8, changes the global library again before application, verifies actual Word `w:line=432` from the pinned preview, retains the PDF source annex, and verifies no provider request for the layout-only candidate. It then performs a metered wording revision and restores the original context as a new version. A segmented runtime workflow passes interruption, explicit retry, clarification, cancellation and failed-initial-save checks while proving later global wording does not enter any resumed section. UI creation and explicit acceptance of a layout revision passed Chromium/WebKit, including EN/DE/AR, narrow RTL and zero provider calls. Full final gates, independent visual PDF review and real update/package acceptance are still required before release.


### Integrated gate and visual export checkpoint

The first integrated `npm test` run completed 409/410. Its single legacy sample-term conflict assertion expected the removed separate learning-term path. Following the full workflow also exposed a real issue: old conflict questions and full review metadata could still carry the nonselected term into a provider request. Provider metadata is now limited to the necessary job facts; app-owned glossary decision questions are removed after binding the chosen term. Canonical wording is sent once, including revisions. Glossary-blocked or superseded terminology is no longer reported as applied or used for sample feedback. The strengthened focused conflict/export/template checks pass 3/3, including absence of the rejected term in the real request. A full follow-up run is in progress; no all-green claim yet.

`node scripts/verify-rule-export.mjs` creates repeatable fictional offline evidence under `outputs/foli-export-verification`. The same canonical rule toggles real Word spacing 240 → 360 and produces two-page PDFs with the source annex. All four rendered pages were visually inspected: the 1.5 output increases body/table spacing, retains margins and legibility without overlap/clipping, and both source pages are intact. On this local LibreOffice runtime, PDF font inspection reports installed substitute fonts rather than licensed Aptos; Word explicitly requests Aptos 11. This export check proves rule spacing and annex behavior, not identical fonts/pixels across machines. It performs zero provider requests.

The offline benchmark passed three cases with zero regressions/requests. Demo build completed in EN/DE/AR. Acceptance and the follow-up full test run are underway. Real two-step desktop upgrade, final browser/platform package/signature validation, release documentation/version metadata and publication remain required.


The follow-up full repository run passed 410/410 at `972ed85` (135.7 s, macOS arm64/Node 23.11.0). Acceptance passed 12/12; benchmark remained three offline cases with zero regressions/requests; EN/DE/AR demo build passed and its generated tracked binary assets were restored. The complete three-engine browser run is currently live. These gates do not substitute for the still-required actual historical desktop upgrade and final release-artifact checks.

Upgrade acceptance will extend the existing Windows installer/WebView smoke path: public 0.12.0 with a fictional legacy profile → unpublished feature-bearing intermediate installer → final candidate, creating approved rules and a local conversation between the two version steps and comparing IDs, values, approval state, profile data and the same encryption key afterward. Mac/Linux checks will continue through the existing packaged-runtime/data-path smoke machinery. No separate build platform or public intermediate release is intended.


### Upgrade-gate preparation and remaining acceptance gaps

The complete browser run covered 66 cases across Chromium/Firefox/WebKit: 65 passed initially; the remaining Firefox reference test completed its UI assertions but timed out with an open page during server teardown. Closing that owned page before the server fixes the cleanup, and the isolated Firefox rerun passes. No product assertion or timeout was weakened. Backup browser fixtures now use the same deterministic cleanup.

The existing Windows installer/WebView gate now downloads checksum- and updater-signature-verified public 0.12.0, seeds a fictional approved/rejected legacy profile, source bytes, budget and historical usage through that installed version's encrypted workspace implementation, and requires increasing 0.12.0 → unpublished 0.12.99 → final-version steps. The intermediate installer is built/signed with the existing toolchain and kept only in runner temporary storage. Local API calls create an approved rule and conversation in that candidate. After stopping its service, its own encrypted store adds two explicitly fictional local chat messages without provider usage. The final installer must preserve their exact IDs/content/versions, legacy approvals/source, usage, budget, preferences and encryption key. The first step exercises an orphaned old service; the second performs a normal closed-service update. A machine-readable report is included with the final Windows artifacts. Actual execution on Windows is still pending.

The existing packaged-runtime smoke also seeds and rereads encrypted rule/profile/chat state and checks the packaged platform data-directory function while writing only to an isolated override directory. This extends Mac/Linux path checks without touching a real user workspace. The fixture/API/reopen contract passes locally in one focused test; this local helper test explicitly does not claim to emulate the old Windows installation. Version metadata can now be changed consistently for the temporary build and restored; a 0.12.0 → 0.12.99 → 0.12.0 round trip leaves tracked version files unchanged. Workflow YAML parses successfully.

Two audit gaps were closed before packaging. The backup API/UI now exposes the existing optional chat exclusion; nine browser cases across all three engines verify streamed/fallback/cancelled downloads and restore an excluded-chat backup with accepted rules intact. Existing uncommon language scopes are retained when opening an editor rather than silently becoming global; the expanded Chromium manual-rule workflow passes. Canonical contexts now consider all matching enabled sample profiles instead of inheriting the legacy three-reference hint limit; a four-sample conflict check passes while schema-1 snapshots retain the former limit. The final required CI run will cover this current head; previous 410/410 results are a checkpoint, not a claim for these newer changes.
