# Translation evaluation fixtures

`cases.json` is the offline technical smoke set of three fictional text documents. `development-cases.json` is a separate 20-case synthetic development collection spanning English and Arabic text for German output across several document families. The synthetic references provide regression fixtures for expected facts and export behavior. Neither collection represents qualified human review or a measurement of complete translation quality.

## Modes and report interpretation

- `npm run benchmark` is shorthand for `--mode technical --set smoke`; it runs the three-case deterministic export/reference pipeline without provider calls.
- `node scripts/benchmark.mjs --mode technical --set development` runs all 20 synthetic development cases through PDF/Word generation and deterministic fact/layout checks without model calls.
- `--mode provided-results --results FILE --set SET` grades supplied results against `smoke` or `development` fixtures.
- `--mode live --model MODEL --max-cases N --set SET` explicitly starts a bounded ChatGPT run. Each selected fixture causes one model request. The script requires `N` between 1 and the selected fixture count before opening the provider connection. It records provider usage only when returned by the provider; unknown token counts and API costs are not inferred.
- `--baseline FILE` adds a comparison against a prior report. It compares only synthetic expected-fact scores and flags lower scores for matching IDs.

Reports include the source revision, whether the worktree was dirty, a hash of the tracked diff, fixture-set fingerprint, translation-policy and export-pipeline fingerprints, case families/languages, request fingerprints for live cases, provider/model, request count, reported usage events, and the comparison baseline. Fingerprints do not expose the source text.

Reports are written to `outputs/benchmark/` by default. Do not put private customer documents or personal translations in public fixtures, supplied results, CI artifacts, or Git. Any future development and acceptance collections must be split by document family, with no source or near-duplicate crossing into a held-out set. Record factual gold-standard provenance and qualified reviewers before presenting language-quality findings.

The 20-case development set is synthetic and has not received qualified linguistic review. The separate 100-case independent acceptance collection has not been collected or reviewed. Live model evaluations and human translation ratings remain outstanding; neither technical score report may be presented as a quality score.

## Private acceptance corpus

Keep a real acceptance corpus in a private local file outside Git. The validator and benchmark never upload it. Use a stable version label for every frozen set. The planned 100-case matrix is exactly:

| Source → target | Cases |
|---|---:|
| Arabic → German | 35 |
| English → German | 25 |
| German → English | 10 |
| German → Arabic | 10 |
| French, Turkish, Spanish, Italian → German | 5 each |

Cover driving licences, civil records, identity documents, education records, forms, letters and long tables. Difficulty labels are `easy`, `medium`, or `hard`. Each JSON fixture needs `id`, `sourceLanguage`, `targetLanguage`, `documentType`, `difficulty`, text `source`, and `expected` fields: `names`, `dates`, `numbers`, `content`, `regions`, `pageCount`, `sourceBlocks`, `questions`, `terminology`, and `structure`. Use empty arrays for categories with no expected entries. Each source block has an `id`, a `kind` (`paragraph`, `heading`, `table`, `stamp`, `handwriting`, `signature`, or `other`) and a boolean `critical` field. Each case also needs `goldStandard.provenance`, `goldStandard.reviewMethod`, and a `goldStandard.reviewers` list with pseudonymous `code`, `qualification`, and ISO `reviewDate` fields. Reviewer statements are recorded as submitted and are not independently verified by the tool.

Audit the private file without printing source text or case IDs:

```sh
npm run benchmark:acceptance:validate -- --fixtures /private/path/acceptance.json --version acceptance-v1
```

The audit checks the planned counts/families, required metadata, exact source overlap with the checked-in smoke/development fixtures, and possible near-duplicates. The latter uses normalized five-word shingles with Jaccard similarity ≥ 0.85 and is only a screening heuristic; inspect flagged cases independently. A passing audit does not prove that the corpus is representative, reviewers are qualified, or gold labels are correct.

To prepare a local text-only human review packet from frozen candidate results, use `--fixtures`, `--fixture-set-version`, `--mode provided-results`, `--results`, `--review-form`, and the separate `--include-source-text` opt-in. The HTML file contains source and candidate text, stays in the ignored local output directory, works offline, and exports ratings locally. Do not commit or upload it. PDF/image source inspection and rendered PDF/DOCX review require separate materials; the form does not include them and does not turn ratings into a quality claim.
