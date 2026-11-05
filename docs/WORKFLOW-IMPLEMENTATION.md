# Community workflow implementation after 0.13.0

This ledger tracks the complete 17-item plan dated 5 November 2026. Work starts from `eb6ccf4` (the published 0.13.0 application plus its documentation/Homebrew-test follow-up). It is not a completion declaration.

| Package | Agreed requirements | State |
| --- | --- | --- |
| P01 | U1 compact learning; U3 compact rules; U4 clear states; U7 localization; U10 consistent controls | Implemented; focused acceptance passed; integrated/release gates pending |
| P02 | U2 usable chat layout and persisted proposal confirmations | Implemented; focused acceptance passed; integrated/release gates pending |
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

## P02 checkpoint

Foli now has a height-aware scrollable log and a separate composer. Empty-chat examples are hidden once a conversation has content; uncommon settings/delete actions use a native disclosure. Compact/typing layouts keep the composer reachable in short viewports, including the visual viewport. Returning from a changed size/locale follows the tail only when appropriate; reading earlier messages retains its position and a new-message action reveals later content. Upward wheel/touch and Home/End intent are handled before resize/scroll-follow callbacks so the browser cannot bounce a reader back to the tail.

Accepted/rejected proposals collapse into persisted-decision confirmations with optional effect/version details. Accepted confirmations explicitly describe the historical decision and link to the current saved rule by an exact bounded ID filter; unrelated library pages/filters cannot hide that target. Missing/deleted targets are explained. Proposal reads/rendering are ticketed against stale responses. Replacements whose target version changed (or was deleted) show a stale state with approval disabled; server version/atomicity checks remain authoritative, and users may still discard or explicitly adjust drafts. No new chat accounting display or model call is added.

Evidence: the expanded existing Foli browser flow uses ten additional fictional local exchanges, keeps a reader at the beginning while a new message appears, returns to the tail, checks a deliberately stale replacement cannot be approved, retains an unsent draft, and exercises 375×800/600/440 layouts plus EN/DE/AR. It passes Chromium, Firefox and WebKit across checkpoints; after the final input-intent fix, WebKit passes and the final Chromium Foli/rule/sample regression run passes 3/3. The Arabic mobile screenshot was inspected. Ten existing Foli/rule HTTP checks pass, including the exact ID filter, missing/oversized selections, CSRF/owner/budget behavior, duplicate request handling and persistence failure rollback. Only the original explicit mock reply/cancellation calls occur; local chat/rule navigation and all seeded exchanges make zero additional provider requests.

A cross-engine check exposed that a pending size-follow callback could interfere with native scroll initiation. Explicit upward intent plus consistent focused-log Home/End handling fixes the product interaction; the beginning/tail preservation assertions remain unchanged. Accepted confirmations after reload still read the persisted proposal result, not transient optimistic UI state. P03–P10 and full installed upgrade/release acceptance remain open.
