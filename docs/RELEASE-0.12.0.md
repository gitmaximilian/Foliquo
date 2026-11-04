# Foliquo Community v0.12.0

This release improves the local Community workflow, personal style configuration and recovery from interrupted work. Qualified human review remains necessary for final translations.

## Changes

- Retain encrypted job history independently of the memory cache, with lazy loading, streamed downloads/backups and authenticated recovery. Existing encrypted workspaces migrate with a recovery copy; update and uninstall preserve the per-user data directory.
- Restore the original beside clarification questions, including PDF/image selection, page navigation, zoom and highlighted source locations. Repeated page changes retain the original PDF bytes.
- Translate and revise long documents in resumable sections. Reuse saved responses, keep questions with their section, honor detected related-page groups where possible, and require deliberate retries when a request may already have consumed quota or API budget.
- Show local Foliquo requests, available provider usage and estimated API costs by period and job. Unknown values remain unknown; ChatGPT account quotas are shown only if the integration supplies them.
- Improve glossary scope, approved variants, import/conflict handling, source coverage review and structured document editing.
- Analyze selected style samples across pages and the finished Word output. Review, edit, scope, approve or discard personal rules; resolve conflicting approved layouts explicitly. The optional finished-translation learning offer remains opt-in.
- Make update failures actionable, distinguish supported automatic desktop updates from manual Linux downloads, and stop authenticated previous services before replacing or restarting the application. Updater package signatures remain distinct from operating-system code signing.

## Downloads and updates

Desktop packages cover Windows x64, macOS Apple Silicon/Intel and Linux x64. Browser/CLI distributions remain available separately. Windows/macOS installations with the updater can install a signed updater package; a manual download remains available if automatic installation cannot start. Install macOS applications in Applications before updating. Linux uses a newer local Flatpak bundle. Existing personal data stays in its per-user folder.

Rank 7 (operating-system signing/notarization and installer trust) is excluded from this task. Windows/macOS packages may still display operating-system trust prompts. Package-manager submission, moderation and public indexing are separate states; a submitted WinGet manifest does not establish availability.

## Evidence and limits

Automated checks use fictional documents and temporary workspaces. Exact run evidence is maintained in [the implementation ledger](NEXT-IMPROVEMENTS-STATUS.md). The historical Windows upgrade check uses the previous public installer and verifies the new service, retained key and saved preferences. Publication occurs only after the applicable build and distribution gates pass.

Independent human translation/OCR quality, terminology accuracy, learning benefit, accessibility and usability studies have not been completed. Personal style configuration is not a claim that a model is trained or that translation accuracy improves. Related-page hints can be missed, particularly across separately analyzed source chunks. Older jobs without valid section maps retain their existing revision path. Compatibility and artifact-repair paths may still load larger records into memory. Keep external backups for device loss; same-device recovery points are not external backups.
