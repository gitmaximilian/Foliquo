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
