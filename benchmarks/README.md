# Translation evaluation fixtures

`cases.json` is currently an offline smoke set of three fictional text documents. Its predefined references verify a small number of facts and export behavior. It does not represent model translation quality, broad document coverage, or qualified human review.

## Modes and report interpretation

- `npm run benchmark` runs the offline reference pipeline without provider calls.
- `--results FILE` grades supplied results against the same fictional references.
- `--live --model MODEL --max-cases N` explicitly starts a bounded ChatGPT run. Each selected fixture causes one model request. The script requires `N` between 1 and the fixture count before opening the provider connection. The report records the provider, model, request count, source revision, and fixture-set label.
- `--baseline FILE` compares fact-match scores with a prior report. This detects only regressions in the listed synthetic expected values.

Reports are written to `outputs/benchmark/` by default. Do not put private customer documents or personal translations in public fixtures, supplied results, CI artifacts, or Git. Any future development and acceptance collections must be split by document family, with no source or near-duplicate crossing into a held-out set. Record factual gold-standard provenance and qualified reviewers before presenting language-quality findings.

The planned minimum of 20 development and 100 independent acceptance documents has not been collected or reviewed. Live model evaluations and human translation ratings remain outstanding; the current three-case report must not be presented as a quality score.
