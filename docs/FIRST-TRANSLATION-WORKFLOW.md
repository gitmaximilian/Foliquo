# First translation workflow

## Audit and implementation priorities

The baseline was Foliquo 0.16.0 at `becf16c`. Three fresh, isolated workspaces ran the actual local app with a fictional PDF and a deterministic provider fixture. Each run started at onboarding, selected the file using the browser upload field, submitted through the real queue, opened the result, acknowledged human review and downloaded both formats. The provider fixture supplied text and one question with source coordinates. The real app rendered the original and generated the export.

| Priority | Where the user had to decide | Observed evidence | Impact / recurrence / effort | Implemented |
| --- | --- | --- | --- | --- |
| 1 | Completed translation and first review | The featured job offered Review, PDF and Word together. Review offered three download buttons, an open-check shortcut and a separate button labelled as a completed review that actually opened learning. | High / every result / medium | The featured job leads to review. Review has one primary route through the current version's human acknowledgement to both formats. Individual formats, applying current rules and detailed counts open on demand. Open checks remain reachable. A version already acknowledged can be downloaded again. Learning appears as an optional action after acknowledgement. |
| 2 | After saving a correction or returning to an existing job | A reload retained the job, but after a successful correction the editor stayed open and required manual dismissal. | High / every saved full-text or structured correction / low | After the server has saved a newer version and it has loaded, close the editor and focus Review and export. Validation errors stay in the editor. Reopening continues to use the existing job and result version. |
| 3 | Clarification on a narrow screen | The desktop original was next to the form. At 375 px it was above the form, and activating the source link updated the source without a clear route back to the same answer. | High / questions on narrow screens / low | The form precedes the source in reading order. The source link takes the user to the original and highlights an available region. Back to answer returns keyboard focus to the current field without replacing it. Additional scans are available inside a disclosure. |
| 4 | First upload and work in progress | The settings sidebar exposed provider management, examples, notes and document context alongside upload. The PDF batch helper also exposed a job-number selector while batch mode was off. A completed job could show “Finished” before human verification. | Medium / every new job / low | Collapse optional job settings and keep batch assignment inside batch mode. Put setup in the action area when a selected file needs a provider. Distinguish a translation ready for review, a paused queue, active processing and a reviewed version ready to export. Keep real progress and the existing indeterminate behavior. |

## Browser measurements

The actions counted are onboarding skip, selecting the file, button activation and final acknowledgement. Text entry, automatic scrolling and reloads are excluded. A detour is a required manual navigation through a separate view or dialog to return to the next workflow step. Deliberate opening of the original is counted as an action but is not a detour. The layout/RTL checks do not add to the scenario counts. The action count excludes disclosure summaries and secondary navigation outside the measured panels.

| Scenario | Actions before → after | Detours before → after |
| --- | --- | --- |
| Straight through | 7 → 7 | 0 → 0 |
| Clarification and original at 375 px | 10 → 11 | 0 → 0 |
| Reload, reopen and correct | 10 → 9 | 1 → 0 |

In all three cases, enabled buttons visible directly in the featured result panel went from **3 to 1**. Direct action buttons in the review export panel went from **4 to 2**. The two remaining actions are export with acknowledgement and the open-check shortcut. On mobile, the additional action explicitly returns focus to the typed answer. The baseline runner scrolled automatically to the submit button, so its lower count gives no estimate of the manual scrolling saved.

The workflow tests verify actual queue state while a fictional response is pending, progress removal when a question needs an answer, the original and its marked region, preserved input and keyboard focus, a reopened work item and a revised version, and final export as PDF with appended original pages plus DOCX. Existing browser cases cover first-run offline demo, multiple desktop sources, versioned review, persistent learning opt-out and rendering after structured corrections. Locale checks cover EN, DE and Arabic RTL.

To reproduce, run `npx playwright test tests/browser/first-translation.spec.mjs --project=chromium`. For a baseline comparison, use a separate worktree at `becf16c`, copy the spec there and set `FOLIQUO_WORKFLOW_BASELINE=1`. The fictional provider removes external calls and does not measure translation quality or live sign-in. The next user test should have newcomers complete these tasks without hints and record whether they identify the next action, recognise the review requirement and return from the original unaided.
