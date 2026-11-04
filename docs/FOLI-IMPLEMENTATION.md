# Foli implementation tracking

Baseline: version 0.12.0, clean worktree at `0a4cd28`. Scope is the private Foli implementation plan dated 4 November 2026, including sample-derived rules. WinGet, operating-system signing and Cloudflare are excluded.

## Architecture decisions

- One versioned rule library accepts reviewed proposals from chat, manual input and samples. Origins are evidence, not separate execution paths or implicit priority.
- Rules and bounded proposals live in the encrypted workspace metadata and participate in existing atomic persistence, recovery and backup/restore. Schema 5 prevents older releases from silently dropping new settings. Migration retains existing collections and keys; legacy sample conversion is explicit and versioned.
- Conversations will use bounded encrypted records outside metadata; accepted rules do not depend on chat retention. No synthetic translation jobs.
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
| F05 | Pipeline foundation implemented | Canonical instructions and layout reach real translation/export; explicit application to old results and visual export review remain required. |
| F06 | Chat/provider foundation implemented; final feature acceptance pending | Encrypted bounded history, one metered provider call per turn, explicit typed drafts, shared review cards, cancellation/uncertain retry and existing budget consent are connected. |
| F07 | In progress | Canonical sample migration is implemented; shared proposal cards, per-rule sample review and full UI/feedback integration remain required. |
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
