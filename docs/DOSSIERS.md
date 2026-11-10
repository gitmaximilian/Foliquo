# Private case dossiers

Dossiers are optional local case overviews. Users explicitly select a case and, when applicable, a person before starting a job. A shared case never proves that two documents describe the same person. Existing case-wide facts remain readable as unassigned legacy facts; selecting a person excludes those facts and every other person's facts from the new job context.

The case overview shows explicitly related documents, detected original values, the document's translated values and separately confirmed preferred values. Name/date/place differences between loaded documents are review hints, not automatic factual corrections. Cross-document comparisons require an explicit person assignment. Each source action opens the existing original viewer without a provider location request. Unknown coordinates remain unknown.

A preferred value requires explicit confirmation and records its fact version, person and origin. A document-based confirmation records only the job ID, field ID and reviewed result version as provenance. It does not copy the original field text into dossier storage. Both the displayed dossier version and source result version must still match when saving. Manual confirmations are marked separately. Confirming a preference does not rewrite any existing translation.

Document reassignment updates the case relationship and unlinks another current case for that owner. Removing a relationship keeps the archived document. Historical result contexts remain frozen. Explicitly applying current guidance in a revision can take a fresh snapshot of the same selected person's facts; a deleted case/person must not cause a fallback to unrelated legacy facts. New job contexts freeze the selected person, preferred facts and their versions/provenance.

Dossier writes run inside the workspace's encrypted durable-write queue. New state becomes visible only after the write succeeds; an already queued ordinary save cannot restore an older case collection. Restart and encrypted backup/restore retain the relationships. Preferred values remain user-confirmed data after a source document is removed, with minimal provenance references and no hidden source-text copy. Deleted documents disappear from the overview.

## Bounded overview

A metadata request inspects at most 20 owned archived jobs, with at most 100 displayed fields per related document. The UI explicitly marks a partially loaded overview and lets the user inspect the next archive section. This includes older archives whose index lacks dossier metadata. No PDF/image objects are hydrated, OCR run or provider called for the overview. A source document's full existing review remains available separately.

Limits remain 100 dossiers, 50 people and 50 preferred facts per dossier, and 500 explicit relationship records per dossier. Owners and existing CSRF checks apply to all endpoints. The overview does not perform global identity learning or silently merge people.
