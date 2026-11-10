# Local content search

The library offers explicit content search alongside its existing paginated filename/type list. It searches stored translations and recognized source text, including an optional saved-version history. Search runs only on submission. Queries and signed continuation/open tokens use the existing owner/session/CSRF-protected POST boundary; no query string, search log, provider request or archive OCR is introduced.

## Storage, updates and recovery

`SearchIndex` reuses AES-256-GCM `SecureStore` with a domain-derived workspace key. Owner directories, document tokens and Unicode bigram keys are HMAC-derived. Root manifests, document manifests, immutable text chunks, posting buckets and transaction journals are encrypted. The derived `search-index/` directory is outside workspace metadata and the primary backup/recovery directory allowlist.

The committed primary job catalog remains the authorization and freshness authority. Queries filter it before reading text and again before returning hits. Signed opens repeat owner, stamp and immutable-reference checks. Continuations bind both the index epoch and the current owner catalog, so a deletion during background maintenance cannot silently shift a later result page.

Successful durable job commits notify the existing background lifecycle. Pausing aborts building, while deletion/stale-entry cleanup remains active. Existing archives build in bounded steps, with progress, pause/resume and explicit rebuild. Actual backup/restore invalidates changed record stamps; an existing local index rebuilds against restored versions. A fresh installation restores the primary records under its own key and explicitly builds a new derived index.

Before each new immutable object is written, its ID is journaled. Root publication occurs last. After an abrupt process exit, recovery compares the durable root epoch with that journal and removes staged objects or obsolete objects accordingly, at most 128 per operation. Cleanup decisions are persisted before deletion. Even a reported failure after durable root replacement cannot remove its live chunks. Corrupt derived data can be explicitly rebuilt without touching originals. Internal format changes publish an empty rebuild state before cleaning previous derived objects.

Posting updates hydrate one bucket at a time. If a bucket would exceed its cap, affected documents become broad candidates and their bounded text is verified during search. They are not silently dropped. The explicit 10,000-document index limit reports incomplete/limited coverage; excess primary documents remain saved and available through the normal library.

## Versions, excerpts and original locations

Hits retain the actual stored version, text kind and original UTF-16 highlight span. Numeric glyphs remain distinct across ASCII, Arabic-Indic and full-width numbers; letter folding supports German, English and Arabic without moving the original highlight.

Historical results open read-only saved text. Signed section navigation allows long versions to be read from their beginning without loading the whole version into the browser. Section ownership removes overlap from consecutive reading sections. An unfinished tail remains explicitly unavailable. Historical opens never silently enter current review. Current review is offered separately and its loaded version is checked again.

Source hits retain saved canonical original locations. Translation provenance uses exact spans from the existing editor/export text serializer, saved inventory-to-node bindings and a digest match against the entire streamed stored translation. A mismatched model, conflicting pages or missing evidence produces no invented location. Ambiguous boxes on the same proven page produce a page-only location. Mapping storage is bounded; unavailable mappings remain explicitly unknown. Original rendering reuses the authenticated original endpoint, source canvas and zoom viewer with `original=1`.

Only non-whitespace recognized source text in the current version counts as available source coverage. Old image documents and incomplete OCR are disclosed rather than automatically reprocessed.

## Bounds

- Query: 2–160 input UTF-16 units; at most 25 hits per response.
- Query reads: at most 64 MiB of encrypted posting/manifest/chunk objects and 8 MiB of text; at most 64 candidate documents per continuation step. The encrypted root is read separately, capped at 8 MiB.
- Index work: at most eight document mutations and four Mi UTF-16 characters per step, followed by an event-loop yield.
- Chunk: at most 64 Ki UTF-16 units, with at least 512 units and 320 graphemes of overlap where possible. Resumption skips the already consumed prefix without segmenting it again. Oversized combining sequences are explicitly limited.
- Document manifest: at most 12,000 chunks, 4,096 HMAC bigram keys and 2 MiB of proven translation mappings. The gram cap uses broad-candidate verification; a chunk cap is disclosed as limited coverage.
- Encrypted object: at most 8 MiB. Index: at most 10,000 documents. Recovery cleanup: at most 128 obsolete/staged objects per operation.

## Measured fictional archive

Run `npm run test:search:profile`. The script follows the existing isolated encrypted-storage/IPC memory harness, uses fresh build/query processes and no provider, and removes its temporary archive. Regression budgets are a 384 MiB build RSS increase, a 256 MiB query RSS increase and 30 seconds per bounded query page. These are technical scenario budgets, not translation-quality or universal latency guarantees.

The recorded local run used 1,001 fictional documents, 56,043,571 bytes of stored text and a separate 20 MiB translation. Initial indexing took 399.0 seconds in 131 steps; the longest step took 3.43 seconds and no step exceeded four Mi characters. Peak RSS increases were 196.3 MiB while building and 107.7 MiB while querying, within both budgets.

| Query scenario | Hits / pages | Total duration | Stored text read |
| --- | --- | --- | --- |
| Rare document marker | 1 / 1 | 161 ms | 665,772 bytes |
| German text | 1 / 1 | 19 ms | 35,070 bytes |
| Arabic text | 1 / 1 | 16 ms | 35,070 bytes |
| All 1,000 ordinary documents | 1,000 / 41 | 13.24 s | 36,356,551 bytes |
| Marker at the end of the 20 MiB translation | 1 / 3 | 4.05 s | 21,136,401 bytes |

The rare search did not decrypt every archive text. Broad matches and a marker at the end of a large text deliberately require further bounded pages. Empty intermediate pages explicitly offer continued searching. These are measurements from one local development run, not fixed speed promises. The ignored raw report is `outputs/workflow-P10-profile.log`.

## Focused acceptance

Core checks cover DE/EN/AR highlights, explicit history, owner-safe opens, encrypted disk contents, restart, changed/restored revisions, deletion, paused deletion, cancellation, pagination, primary-catalog cursor invalidation, bucket pressure, document limits and corrupt-index rebuild. Real subprocess exits exercise both sides of root publication; cleanup limits and post-rename failure are checked. An actual streamed encrypted backup is restored into the same workspace and a fresh workspace/key, preserving versions, locations and original bytes.

The reproducible Chromium and WebKit case covers keyboard opening/focus return, a translation hit at actual original PDF page 3, read-only long-history navigation, EN/DE/AR, German dark mode and Arabic 375-pixel layout. It verifies no page errors, external browser requests, provider calls, unexpected version changes or original-byte changes. Desktop/dark/mobile screenshots were inspected. It exposed and fixed overlapping close/open dialogs, WebKit launcher focus and missing shared viewer translations. Fixtures and images remain under ignored outputs. Yab was tried first but could not open the local fixture URL; existing Playwright tooling provided the fallback.

P10 focused acceptance is complete. Integrated repository checks, installed upgrade, packages and publication remain separate required gates. No version or release has changed.
