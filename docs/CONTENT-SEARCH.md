# Local content search — implementation checkpoint

The library now contains an explicit content-search panel in addition to its existing paginated filename/type list. Search submits only on the user's action. The query and signed continuation/open tokens use session/CSRF-protected POST bodies, never query strings or a search log. Search performs no provider request, OCR or image-archive reprocessing.

## Stored data and authorization

`SearchIndex` uses the existing AES-256-GCM `SecureStore` with a domain-derived workspace key. Owner directory names, document tokens and Unicode bigram keys are HMAC-derived. Root manifests, per-document manifests, immutable text chunks and immutable posting buckets are all encrypted. The root is published after new chunks/manifests/buckets; old referenced objects are removed after publication. Index errors are isolated from primary job commits. The index lives under `search-index/`, outside workspace metadata and the primary backup/recovery directory allowlist. Restored primary records invalidate their former index stamps and can be indexed again.

Primary committed catalog entries are the authorization and freshness authority. Candidate filtering happens before text-chunk reads and again before returning results. Opening a signed result repeats the owner/stamp/reference check. Historical results retain their explicit saved version and open read-only excerpts; the current review workspace is offered only for a current result. Opening current review checks its loaded version again. Original rendering reuses the source endpoint, source canvas and zoom viewer with `original=1`. Known page-only locations remain page-only; unknown locations are disclosed.

## Current bounds

- Query: 2–160 input UTF-16 units, at most 25 hits per response.
- Query reads: at most 64 MiB of encrypted posting/manifest/chunk objects and 8 MiB of text chunks; at most 64 candidate documents per continuation step. The existing small encrypted root is read separately, capped at 8 MiB.
- Index step: at most eight document mutations and four Mi UTF-16 characters, then an event-loop yield. Pause aborts the current background build; stale document cleanup still runs while paused.
- Chunk: at most 64 Ki UTF-16 units, with at least 512 units and 320 graphemes of boundary overlap where possible. Oversized combining sequences are explicitly limited. Overlap ownership and non-terminal numeric boundaries are checked at query verification.
- Per-document manifest: at most 12,000 chunks and 4,096 unique HMAC bigram keys. Above the gram cap the document becomes a broad candidate so later text is still verified rather than silently excluded. The chunk cap is explicitly reported as limited coverage.
- Encrypted object: at most 8 MiB. The root follows the existing 10,000-document catalog ceiling. Bucket-cap behavior for unusually high-entropy large archives still needs final hardening/measurement.

These are implementation bounds, not measured performance promises. Numeric glyphs remain distinct across ASCII, Arabic-Indic and full-width forms. Letter normalization maps matches back to stored original UTF-16 positions.

## Evidence and remaining work

Focused core checks cover DE/EN/AR, exact original highlights, explicit history, owner-safe opens, encrypted disk contents, restart, changed/restored revisions, deleted documents, bounded pause/resume, pagination and rebuilding corrupt derived data without changing primary records. The API check covers the actual session/CSRF boundary, owner-isolated tokens, asset serving, background save/delete maintenance (including paused indexing), request limits and zero provider calls.

An initial Chromium view check on fictional data inspected the German results, saved current excerpt, source excerpt beside actual original PDF page 3, historical read-only excerpt and Arabic 375-pixel view. No page errors or mobile horizontal overflow were observed. The screenshots and local fixture scripts stay in ignored outputs. Yab was tried first but could not open the local fixture URL, so the existing Playwright browser tooling was used.

P10 is **not accepted yet**. Remaining work includes translation-span provenance, crash-interrupted derived-object cleanup, final index/bucket pressure behavior, faithful navigation of long saved historical text, measured archive duration/peak memory using the existing harness approach, and reproducible browser coverage for keyboard/dark mode/EN/DE/AR and relevant engines. Full repository, actual installed upgrade, package and publication gates remain outstanding. No version or release has changed.
