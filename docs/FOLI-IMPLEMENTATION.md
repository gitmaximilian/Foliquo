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
| F02 | Foundation implemented, API transactions pending | Bounded typed rules/proposals, explicit approval, optimistic versions, idempotent repeated approval and inactive/deleted-rule preservation implemented. Workspace schema 5, encrypted persistence and both backup formats include the library. |
| F03–F08 | Pending | Resolver, views, pipeline/export, chat, sample integration, upgrade and release gates remain required. |

No feature completion or release is claimed. Existing 0.12.0 artifacts are unchanged.

### Foundation verification

Targeted local checks passed: 10/10 rule and existing learning-selection cases, followed by 8/8 focused rule/schema migration cases after adding stream backup and write-failure checks. Fictional encrypted schema-4 data migrates with a byte-identical recovery copy and unchanged key/profile/approval state. Rules survive restart, TOCRBACK1 restore and TOCRBACK2 stream restore. Invalid rule writes and injected ENOSPC leave the committed manifest unchanged. Existing schema-1/schema-2 migration checks pass with the current schema constant. No user workspace or live provider was accessed.

Full repository gates, UI, resolver/context integration, sample conversion and release remain pending. The rule API still needs transaction rollback and concurrency integration before exposing mutations.
