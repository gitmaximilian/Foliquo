# Translator comparison protocol

**Status: prepared, not run.** No participants have been recruited, no study documents have been collected, and no live provider or account-limit calls have been authorized or made for this comparison. The files in [evaluation/](evaluation/) are blank planning templates, not measurements. Automated checks and fictional demo exports do not establish a translation-quality improvement.

## Scope and approvals

Compare one frozen published baseline with the newly published Community release on **at least 30 independent documents and 3–5 qualified document translators**. Four or five participants are preferred. Keep the Community edition, PolyForm Noncommercial license, loopback service, encrypted local workspace, and human-review boundary unchanged.

Before scheduling or running the study, obtain approval for the participant invitation, document use and redaction, any provider transmission, selected accounts/models, spending limit, and retention period. Preparing this protocol does not authorize recruitment, uploading documents, spending money, or deliberately exhausting an account quota. Keep originals, completed forms and outputs in a private study directory outside Git; commit only empty templates and an explicitly approved anonymized aggregate report.

## Freeze the comparison

Complete [study-metadata.json](evaluation/study-metadata.json) before the first measured session:

- Record exact baseline/candidate release tags, source commits, package names and verified SHA-256 digests. A local version number or successful build alone does not prove publication.
- Use the same OS/device class, provider, exact model ID, language pair, approved style samples and input documents in both conditions. Record model/plan changes rather than treating them as application effects.
- Use separate private study workspaces with identical approved starting settings. Never replace a participant's real workspace or import private learning data without permission. Disable learning from measured cases during the comparison.
- Pre-register order, quality rubric, denominators, exclusions and decision rules. Keep failed tasks and timeouts in the results. Record deviations before interpreting outcomes.
- Without approval for provider calls, use identical frozen response fixtures and label the exercise **offline workflow replay**. It can measure workflow, correction and export behavior; it cannot measure live translation quality, provider reliability or account limits.

## Corpus: 30 independent documents

The 30 IDs in [corpus-slots.csv](evaluation/corpus-slots.csv) are empty slots and do not count as collected documents. Select five eligible documents in each primary stratum:

| Primary stratum | Minimum | Coverage to record |
| --- | ---: | --- |
| Identity and civil records | 5 | Names, dates, numbers, photograph description and authority names |
| Administrative letters and certificates | 5 | Paragraphs, headings, ministry terminology and document purpose |
| Forms and tables | 5 | Required fields, reading order, empty fields and table widths |
| Stamps and handwriting | 5 | Stamp color/shape, signatures, logos/coats of arms and handwritten notes |
| Degraded or clipped scans | 5 | Rotation, low contrast, clipping, uncertain text and missing regions |
| Related multi-page documents | 5 | Page order, cross-page names, original appendix and export completeness |

Each item must be a distinct underlying document/case. Crops, rescans, translations, repeated pages, demo variants and front/back pages of the same document are not independent items. Count a related multi-page set as one document. Record an independence cluster and source/template family privately; replace duplicates before the study. If related cases cannot be replaced, disclose clustering and do not report 30 independent observations.

Start with the target language pair (for example Arabic → German); record additional pairs as separate exploratory strata. Do not generalize one pair's result to all languages. Include the real range of complexity, including difficult and failed cases. Use consented, appropriately redacted material whose redaction preserves the feature assessed. Two separate practice documents are excluded from the 30 measured cases.

Before sessions, qualified reviewers establish the required source fields, source page count, visible stamp/signature/handwriting elements, clipping, and reference interpretation. Independently review and adjudicate these annotations against the source; mark genuinely uncertain items as uncertain. Hide the reference from task editors until scoring.

## Participants and assignment

- Use 3–5 qualified translators experienced with the selected language pair and document types. Record experience under pseudonymous IDs; no names/contact details belong in Git.
- Process each document once with the baseline and once with the candidate, by **different editors**: 60 planned production sessions. No editor sees the same source in both conditions.
- [sessions-4-reviewers.csv](evaluation/sessions-4-reviewers.csv) allocates 15 sessions to each of four participants. It is a draft allocation, not a schedule or invitation. Randomize each participant's order with a recorded seed after approval; counterbalance condition order and fatigue. Keep condition allocation hidden from output raters.
- For three participants, rotate baseline editor `(document_index mod 3)` and candidate editor `((document_index + 1) mod 3)`: 20 sessions each. For five participants use the same rotation modulo five: 12 sessions each. Indices start at zero. Never assign both conditions of a document to the same editor.
- With four/five participants, use two raters who edited neither version of that document. Hide condition, release and editor identities during scoring; randomize output order. With three participants, use the remaining independent rater first, then a second assessment/adjudication with prior familiarity recorded. Do not call that second assessment fully independent.
- Preserve raw independent scores before adjudication and report agreement. Do not resolve disagreement by revealing the producing condition.

## Session procedure

1. Give everyone identical onboarding and two unmeasured practice cases; do not coach one condition more than the other.
2. Start from frozen workspace settings. Open/prepare the assigned source and choose the assigned language/model. Translate only within the approved provider/document budget.
3. Answer questions, inspect/copy source text, revise, and export PDF and Word. Stop when the editor would pass the result to professional review, or at the pre-registered timeout. This does not certify the translation.
4. Record active work, provider wait and elapsed time separately, including rework. Record crashes, lost input, retries, failed exports and incomplete cases; never silently discard them.
5. Save originals/outputs under study IDs privately. Record actual source/translation/appendix page counts and output hashes so raters assess identical bytes.
6. Collect blinded output ratings and identical usability/confidence questions before adjudication. Public defect descriptions must contain no source text or personal data.

## Measurements and rubric

Use [session-results-template.csv](evaluation/session-results-template.csv), [defects-template.csv](evaluation/defects-template.csv) and [scores-template.csv](evaluation/scores-template.csv). Copy templates outside Git before entering real study data. In the score sheet, use separate criteria for names, dates, numbers, authorities, completeness, signatures, handwriting, photographs, stamps, bracket preservation and typography; record eligible/correct counts for each.

| Measure | Definition / denominator |
| --- | --- |
| Critical error | Omission, invention, wrong identity, material number/date/negation or other meaning change that could materially mislead use. Count affected documents and defects separately. |
| Major error | Meaning/completeness error requiring correction but not critical. Report per document and per 1,000 source words, using the frozen reference count. |
| Minor error | Style, spelling or formatting correction without a material meaning change. Keep separate from major errors. |
| Field accuracy | Correct required fields / eligible reference fields; report names, dates, numbers and authorities separately. Explicitly exclude genuinely uncertain reference fields before condition outcomes are known. |
| Completeness | Required source content represented; clipped/unreadable portions acknowledged without invention; source and original-appendix pages complete. |
| Conventions | Unreadable signature without invented name/question; `[Handschriftlich: …]`; `[Lichtbild]`; stamp color/shape and compact border; non-text brackets; correct header/font/body size. Count applicable items and failures. |
| Workflow | Completion/failure, unnecessary questions, submitted answers, copied OCR accuracy, crop availability, recovery and valid PDF/Word exports. |
| Time | Active editing, provider wait, rework and end-to-end elapsed time; report document-level paired differences and uncertainty. Speed alone is not a quality gain. |
| User rating | Fixed 1–5 ease-of-use/confidence questions and an open defect note. Confidence is not accuracy. |

Count each root defect once; flag affected fields separately instead of duplicating defect descriptions. Record whether it occurred in the unedited draft, was corrected by the editor, or survived into the export. Grade against source/reference, not the other condition's wording.

## Analysis and claim boundary

Analyze paired baseline/candidate results by document. Report every planned ID, attempted/completed counts, missing data, exclusions, deviations, participant workload and corpus distribution. Report critical/major/minor errors separately, field accuracy and active/elapsed time, with paired differences and uncertainty. This small purposive sample does not establish general performance across all document types, languages or providers.

Pre-register quality and time as separate outcomes. No new data loss, missing original appendix or unsupported identity/signature invention is acceptable without investigation. A quality-improvement claim needs measured, blinded evidence for the pre-registered quality outcome and its uncertainty, with no hidden critical-error regression. Report mixed/incomplete/inconclusive results as such; do not relabel a timing or satisfaction improvement as accuracy.

Current wording: **“A real comparison with at least 30 independent documents and 3–5 qualified translators is prepared but has not been run. No measured translation-quality gain is claimed. Live provider reliability, account limits and real-world usage costs remain untested.”**

## Separate live provider / account-limit check

Only after specific approval, record provider/model, account/plan, permitted samples, request/token/spend ceiling and stop condition. Begin with a small non-personal smoke case. Record authentication, model availability, explicit throttling/limit responses, timeouts and exports separately. Do not deliberately exhaust an allowance, expose credentials in logs, or infer plan entitlement from an anonymous health check. This check has not been run for the prepared comparison.
