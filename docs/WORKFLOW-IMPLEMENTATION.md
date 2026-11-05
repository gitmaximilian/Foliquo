# Community workflow implementation after 0.13.0

This ledger tracks the complete 17-item plan dated 5 November 2026. Work starts from `eb6ccf4` (the published 0.13.0 application plus its documentation/Homebrew-test follow-up). It is not a completion declaration.

| Package | Agreed requirements | State |
| --- | --- | --- |
| P01 | U1 compact learning; U3 compact rules; U4 clear states; U7 localization; U10 consistent controls | Implemented; focused acceptance passed; integrated/release gates pending |
| P02 | U2 usable chat layout and persisted proposal confirmations | Pending |
| P03 | U5 actual local layout examples; U6 explicit sample activation | Pending |
| P04 | G2 visual, version-bound source coverage | Pending |
| P05 | G3 critical facts; G7 unified review; U9 frozen rule traces | Pending |
| P06 | G4 complex document model/export improvements | Pending |
| P07 | G5 explicit, multi-person dossier relationships | Pending |
| P08 | G6 bounded local page scan checks and reversible corrections | Pending |
| P09 | G8 confirmed local batch grouping proposals | Pending |
| P10 | G9 bounded, encrypted, rebuildable content search | Pending |

Excluded: U8 additional in-chat usage display, G1 independent linguistic study, G10 reviewed starter profiles, WinGet submission, OS signing/notarization and Cloudflare. Existing accounting/budgets remain intact.

Preserve original bytes, the original-page annex, encrypted user data, local-only management, owner/CSRF checks, supported interfaces/locales and frozen result versions. Extend existing modules rather than introducing parallel engines. New UI views do not authorize provider calls. Use fictional fixtures only. Run focused checks while changing a package; the integrated repository and actual package/upgrade/publication gates remain required before release.

## P01 checkpoint

Rules now use compact rows with always-visible scope/origin/switch and expandable details/actions. Search/status remain primary; additional filters are disclosed with a visible active-filter summary and reset. Rule/sample tabs share semantic theme tokens and explicit selected state. Rule dialogs use the application font, surfaces, borders and backdrop. Five short rules and switches fit 1280×900 without scrolling. Arabic RTL at 375 px and dark mode were inspected, as was the German desktop screenshot. Stable screenshots disable finite transitions to avoid capturing intermediate theme colors.

Canonical sample cards initially show an accurate derived pending/accepted count; proposals, evidence and history are loaded on explicit expansion. Pending proposal pagination stays in the sample. Legacy analysis details are disclosed while explicit editing remains available. Displayed language names/layout labels/numbers follow the interface locale. New generated rule titles carry optional validated `titleMode` provenance through encrypted persistence. Manual/Foli replacements remain custom; duplicate sample evidence cannot rename an existing custom rule. Old sample-only records are localized only when their exact title matches a known generated layout/field-order signature; custom/manual/chat titles remain untouched. No provider request is added.

Evidence: 21 focused rules/sample/Foli checks passed, including explicit-title replacement/duplicate protection, encrypted restart/backup and failed writes. Seven existing HTTP/learning cases passed, including approval atomicity, stale decisions, glossary and source removal. Rule/sample browser flows passed Chromium, Firefox and WebKit; the existing legacy profile-edit flow passed WebKit. Expanded rule flow verifies five visible desktop rows, generated German decimal formatting versus unchanged custom titles, keyboard tab state, scope retention and zero provider calls. A final Chromium sample flow verifies old generated titles without the new provenance field still display correctly.

The new sample summary made the old browser assertion “contains Accepted” insufficient because that label exists before approval; it now waits for the actual approved rule row before checking persisted state. The desktop fit check initially exposed inherited top margins and separate metadata lines; shared compact row styles remove those while preserving 44 px switches. The final requirement remains unchanged and passes. These checks do not stand in for P02–P10 or final package/upgrade/publication acceptance.
