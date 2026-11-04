# Foliquo Community v0.13.0

This release adds Foli and one reviewed personal-rule library shared by chat, manual editing and sample analysis. It configures the local Community workflow; it does not train model weights or prove translation accuracy.

## Changes

- Describe preferences in the new Foli chat. Review, adjust, accept or discard typed proposals before they affect translations. Foli reuses the existing AI connection, usage accounting and API budget.
- Manage rules under Learning → Rules and inspect their applicability beside Translate. Language/document scopes, sample dependencies, permanent switches and one-job exceptions are distinct. Equal-priority conflicts require a choice.
- Derive shared proposals from samples, using measurable Word properties before estimates. Review evidence and uncertainty; preserve existing approved profiles and rejected observations. The finished-translation learning offer remains optional.
- Freeze rules for each job and its continued sections. Apply current rules to an existing translation only through an explicit revision proposal, keeping earlier versions restorable. Layout-only revisions rebuild PDF/Word locally.
- Keep accepted rules and encrypted chat records in the per-user workspace. Backups can omit chat history while retaining rules and profiles. Removing a sample offers an explicit choice for dependent rules; deleting a chat retains accepted rules.
- Avoid sending nonselected terminology choices or duplicated canonical wording through stored review metadata. Retain complete version traces for applied rules and distinguish blocked glossary rules from effective ones.

## Downloads and updates

Desktop packages cover Windows x64, macOS Apple Silicon/Intel and Linux x64. Windows/macOS use verified updater packages; Linux uses a newer local Flatpak bundle. Browser/CLI packages and Homebrew remain separate distribution paths. Existing per-user data and keys remain outside installation directories.

The release gates require a real public Windows 0.12.0 installation, an unpublished intermediate candidate and a subsequent final candidate, with retained legacy sample data, approvals, rules, chat messages, usage, budget and key. Packaged-runtime checks cover the other platform data paths. Exact executed evidence is recorded in [the implementation ledger](https://github.com/gitmaximilian/Foliquo/blob/main/docs/FOLI-IMPLEMENTATION.md).

WinGet submission, operating-system signing/notarization and Cloudflare deployment are excluded. The existing unsigned desktop packages can still show operating-system trust prompts; updater signatures are a separate verification mechanism.

## Practical limits

Model-derived wording, sample observations and OCR require professional review. Privacy filters are safeguards, not proof that every personal fact was identified. Free-text conflicts cannot all be detected. Word requests Aptos 11; PDF fonts can be substituted by the local export runtime when the licensed font is unavailable. Pixel-identical appearance across operating systems is not claimed. ChatGPT quota/cost values remain unknown unless actually reported, and uncertain interrupted requests are never automatically retried.

Read [the personal-rules guide](https://github.com/gitmaximilian/Foliquo/blob/v0.13.0/docs/PERSONAL-RULES.md) for approval, scope, source removal, revision, backup and retention behavior.
