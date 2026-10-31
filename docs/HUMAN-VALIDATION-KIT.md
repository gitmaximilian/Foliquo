# Foliquo Community Human Validation Kit

Status: protocol prepared; no participant sessions have been run. This kit is a preparation aid and does not count as usability, accessibility, terminology, or translation-quality evidence.

## Purpose and safeguards

Use this protocol to assess first-use clarity, learning controls, usage visibility, keyboard access, and screen-reader behavior in Foliquo Community. Run sessions on a release candidate only after installing it from a clean, temporary workspace.

- Use only the built-in fictional demo or the fictional fixtures named in the task sheet. Do not ask participants to upload real documents, enter personal information, sign into their own provider account, or provide credentials.
- Do not record audio, video, screen captures, names, email addresses, employer details, or document contents. Participation is voluntary and may stop at any time.
- Give participants the short consent statement below. Record only a random session code, selected interface language, task outcomes, elapsed time, help requests, and non-identifying observations.
- Do not coach during an unaided task. If a participant asks for help, provide the minimum help needed, mark the task as assisted, and continue without treating it as an independent success.
- Keep usability observations separate from translation quality. Never infer translation accuracy from navigation success.

## Session setup

1. Record the build/version, operating system, browser or desktop shell, interface language, viewport size, and whether keyboard-only or assistive technology is used.
2. Create a new temporary Foliquo workspace for each session. Confirm it contains no prior jobs, learning rules, provider credentials, or personal documents.
3. Start with a clean browser profile. Use the built-in fictional demo for the first-use task. Provider sign-in is not needed for that task.
4. For API usage tasks, use a local mock-provider fixture that creates clearly synthetic request and token entries. Never send a real API request or enter a live API key.
5. For ChatGPT usage tasks, use the mock provider to create synthetic local call counts and a synthetic limit error. Do not connect a participant's account.
6. Provide a keyboard, a 200% zoom setting, and the available screen reader for the participant's platform. Ask which assistive technology they normally use; do not collect identity details.

## Opening statement

“We are evaluating Foliquo, not you. You can stop at any time. Please use only the fictional example provided. We will not record your screen or collect your name, account, or document contents. I will stay quiet while you try each task, then ask what you expected and what was unclear. Is it okay to continue?”

Record consent as `yes` or `no` against the random session code. If `no`, end the session without recording task data.

## Participants and session plan

Recruit participants who have not helped build Foliquo. Include a mix of people who regularly translate or review documents and people who do not. For Arabic checks, recruit participants who can evaluate Arabic UI and RTL behavior; a qualified language reviewer is needed for terminology or translation judgments. Do not claim statistical representativeness from a small formative sample.

Recommended formative session: 30–40 minutes. Run tasks 1–5 in the participant's chosen supported UI language. Run tasks 6–7 with a participant who uses a screen reader or keyboard navigation. Run task 8 only with a qualified Arabic reviewer. A participant may skip any task.

## Task script

Read only the task in quotation marks. Start the timer when the participant begins interacting. Stop when they state they are done or abandon the task. Do not point to controls.

1. **First use, fictional demo** — “Show me how you would try Foliquo on the provided example and get to a finished translation you can review.” Measure time to first successful review, completion, help requests, and whether the participant notices that the example is fictional. Target: at least 8 of 10 participants complete without individual help in under five minutes after the app is ready.
2. **Data flow explanation** — “Before continuing with a real document, tell me what you think stays on this device and what would be sent to an AI provider.” Do not correct until they finish. Record which specific concepts they explain correctly: local encrypted workspace, provider choice, document transfer only after a model request, and possible separate API charges. Do not record this as legal/privacy approval.
3. **Personalization** — “Find a way Foliquo could learn your preferred style from this finished example. Add it only if you want to, then find how you would turn it off.” Observe whether the choice is optional and understandable, whether “later”/dismiss is clear, and whether the participant can find deactivation. Do not create a real rule from their personal writing.
4. **API usage** — “Find how many requests and tokens this fictional API example used this month, then find the usage for one job.” Record success, time, and whether the participant understands cost is an estimate when labeled as such.
5. **ChatGPT usage and limits** — “For this fictional ChatGPT example, find Foliquo's local call count and tell me whether the provider reported a usable quota or a limit error.” Check that the participant does not mistake local counts for official provider quota, and that unavailable quota remains visibly unavailable.
6. **Keyboard-only critical path** — “Using only the keyboard, open the example, move through its review, edit one fictional text item, and return to the job list.” Record focus visibility, traps, unexpected focus moves, unreachable controls, and whether each action can be completed without a pointer.
7. **Screen reader and zoom** — Ask the participant to navigate the language selector, a job progress update, a review warning, and a dialog at 200% zoom. Repeat in English and Arabic where the participant is comfortable. Record the assistive technology and version, spoken label/status, RTL order, clipping, and any blocker. Do not use an automated accessibility score as a substitute for this task.
8. **Arabic terminology and directionality (qualified reviewer only)** — “Review the fictional Arabic interface and sample output for direction, mixed digits, punctuation, and any terminology that looks confusing. Tell me what you would change and why.” Record suggested changes without presenting them as validated unless a qualified second reviewer confirms them.

## Recording sheet

Use one copy per session. Keep only the random code; delete raw notes after the findings are summarized and checked for accidental identifying information.

| Field | Entry |
|---|---|
| Random session code | |
| Foliquo version / commit | |
| OS and browser or desktop shell | |
| UI language and viewport | |
| Keyboard-only / assistive technology and version | |
| Consent | yes / no |

| Task | Started / completed | Seconds | Unaided / assisted / abandoned | Error or help needed (short, non-identifying) |
|---|---:|---:|---|---|
| 1. First use | | | | |
| 2. Data flow | | | | |
| 3. Personalization | | | | |
| 4. API usage | | | | |
| 5. ChatGPT usage | | | | |
| 6. Keyboard path | | | | |
| 7. Screen reader / zoom | | | | |
| 8. Arabic review | | | | |

## Reporting and decision rules

- Report the number invited, number who consented, and any skipped tasks. Do not turn a small formative sample into a population-wide percentage claim.
- Report first-use completion count and median/range of completion times. The plan's target is at least 8 of 10 unaided completions within five minutes; if fewer than 10 participants are available, label the result preliminary and do not claim the target was met.
- For each critical accessibility task, report blockers separately from preferences. Any control that cannot be reached or understood with the tested keyboard/screen reader blocks that flow until fixed and retested.
- Group observations into concrete interface changes. Preserve separate findings for German, English, and Arabic/RTL; do not average language-specific failures away.
- A terminology or translation-quality statement requires a qualified reviewer and a separate documented review method. This usability kit does not certify translation quality.
- Publish only aggregate, non-identifying findings. Link the report to the tested version and state the participant count, tools, limits, unresolved blockers, and follow-up status.

## Results template

After sessions, replace this section with the versioned findings; until then keep the status explicit.

- Sessions completed: **not run**
- First-use target (8/10 under five minutes): **not measured**
- Keyboard/screen-reader blockers: **not measured**
- API/ChatGPT usage comprehension: **not measured**
- Qualified Arabic/terminology findings: **not measured**
- Follow-up fixes and retest version: **not available**
