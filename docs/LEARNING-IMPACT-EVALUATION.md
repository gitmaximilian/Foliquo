# Personal learning impact evaluation

The paired study checks whether approved personal rules reduce repeated wording and terminology corrections without increasing critical fact errors. The script evaluates reviewer-entered counts; it does not translate documents or verify reviewer qualifications.

## Protocol

1. Freeze the set of approved rules and record the study ID before reviewing outputs. Do not change rules during the paired review.
2. Select at least 20 independent documents. Exclude documents used to create the rules and near-duplicates from the same source document.
3. Produce two versions per document with identical source, provider, model, prompt, and non-learning context. One version uses the approved rules and the other does not.
4. Have a qualified reviewer compare the versions in randomized order with the learning condition concealed. Count corrections using the same written rubric for both: wording/style corrections, terminology corrections, and critical fact errors (names, dates, numbers, omissions, or invented facts).
5. Enter only pseudonymous case IDs, attestation flags, and counts into the input JSON. Do not add documents, translations, reviewer names, or free-text notes.
6. Run `npm run learning:impact -- --input /path/to/anonymized-review-counts.json`. The report is written to `outputs/learning-impact/report.json`; choose another `--output` path if needed.

Example input shape:

```json
{
  "schemaVersion": 1,
  "studyId": "pilot-2026-01",
  "cases": [
    {
      "caseId": "case-001",
      "independentDocumentAttested": true,
      "qualifiedReviewAttested": true,
      "blindLabelsAttested": true,
      "randomizedOrderAttested": true,
      "withoutLearning": {"styleCorrections": 3, "terminologyCorrections": 2, "criticalFactErrors": 0},
      "withLearning": {"styleCorrections": 2, "terminologyCorrections": 1, "criticalFactErrors": 0}
    }
  ]
}
```

The example is illustrative and has fewer than 20 cases; it cannot pass the study gate. Reports label counts and attestations as provided and not independently verified. They omit the study and case IDs; the CLI summary prints only aggregate values. A passing result requires at least 20 cases, a reduction of at least 20% in combined style and terminology corrections, no aggregate increase in critical fact errors, and no per-document critical fact regression. These gates do not replace linguistic quality assessment or establish statistical certainty.
