# Reviewed local batch grouping

Batch preparation extends the existing manual file-group and PDF-range import. It does not call a translation provider, OCR engine or Foli. A local preview counts PDF pages and uses the existing local converter for supported Word/image formats when necessary. Only the selected original page is rendered on demand with the existing bounded source viewer. File and page limits remain unchanged.

Filename hints can suggest front/back/attachment relationships or explicitly numbered page sequences. Matching stems alone do not merge ambiguous files; generic front/back names without a shared stem remain separate. Upload order is preserved unless there is a clear within-document filename/role sequence. Multipage files initially stay together. All suggestions remain explicitly uncertain and show their reasons. Manually selected page roles are distinguished from filename hints.

The editor can name groups, move pages, split groups and merge groups. It displays at most 20 page rows at a time and supports two to ten groups. Every original page has one group assignment. Empty groups cannot be applied. Locally converted multipage Word/TIFF sources can also be split by page; their normalized PDF is frozen for subset extraction while the raw upload remains unchanged. Ordinary single-page images stay intact. The backend validates coverage, overlap and page ranges again before accepting a batch.

Target language, use of learning, dossier and person are explicit per-group options. Shared templates, profiles and other main-form options remain visible in the final review. Grouping never guesses a dossier or person from a filename. Explicit main-form case selections can be inherited, reviewed or changed per group. Each group receives its own frozen context-library snapshot so different target languages or people cannot inherit the first group's private facts or glossary accidentally.

Applying the editor only stages the grouping. Starting requires a separate native confirmation dialog showing every group's files/pages, target language, learning state, dossier/person and relevant shared settings. A required checkbox explicitly confirms all those choices. The client checks that files, groups, provider/model and main-form options still match after confirmation. Cancelling either dialog sends no translation request.

## Retries and continuation

A confirmed start stores a bounded local pending identity containing only an opaque request ID, client ID and digest. It stores no filenames, document text or options in plaintext. The digest is independent of incidental browser MIME labels. A retry after a lost response reuses the same request/client identity, including from a newly loaded client. The pending identity is acknowledged only after the completed submission is reflected locally and its original file selection cleared.

The existing server request hash remains authoritative and owner-scoped. Reusing an ID with changed input is rejected. An initial manifest whose durable write failed can be saved and submitted again without creating a second manifest. Existing batch contexts are retained on idempotent retries. Repeating a start does not authorize another wave after the first wave has begun; the remaining groups require the existing explicit continue/resume action. Queue slots, paused-queue startup recovery, checkpoint behavior and source/page provenance continue to use the existing mechanisms.

For converted sources, only the normalized data needed to extract page subsets is retained alongside the original batch source until the intended jobs are created. Source data is removed from the manifest once all groups have been submitted, as before. Public batch snapshots expose names/options/status, not source data or private fact contents. The local preparation cache retains at most 100 owner-scoped digest/page-count/type records that expire after an hour, with no document text or rendered page images.

Focused evidence is recorded in `docs/WORKFLOW-IMPLEMENTATION.md`; final repository, installed upgrade and release checks remain separate gates.
