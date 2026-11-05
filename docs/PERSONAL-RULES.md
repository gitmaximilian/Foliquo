# Foli and personal translation rules

Foli, manual editing and sample analysis use one local rule library. They configure Foliquo's future translation behavior; they do not train model weights or establish that a translation is correct.

## Start with Foli

Open **Foli** and describe a preference, for example “For German translations use line spacing 1.5.” Foli uses the AI connection and model already selected in Foliquo. A reply can explain a setting, ask a question or show separate rule proposals. It cannot approve its own proposals.

Review the effect and scope, then choose **Accept rule**, **Adjust** or **Discard**. Accepting several deliberately selected proposals is also possible. A rejected proposal never changes an active rule. Existing versions are checked before changes are accepted; refresh a stale proposal instead of overwriting a later edit.

Documents and previous translations are not automatically attached to the rule chat. Its model context contains a bounded selection of relevant rules and recent messages. General information does not create a rule. Ambiguous or unsupported requests should be clarified rather than presented as working settings.

## Use samples as evidence

The sample upload and optional finished-translation offer share the same analysis path. Before starting, review the selected files, provider and expected analysis requests. Analysis sends the selected material to that provider only after your action. A finished translation is never added automatically.

Word properties can be read from the file; layout inferred from a PDF or scan may only be an estimate. Cards show the source, analysis version, method and available page references. Unsupported or uncertain observations can remain descriptive. A monolingual target sample is not evidence for an invented source/target terminology pair.

Review each proposed rule and its scope. Accepting a rule does not automatically enable its source profile. The sample switch controls rules still dependent on that sample; an individually disabled rule remains disabled when a sample is enabled again. All matching enabled samples participate in new canonical rule selection. Feedback ordering does not silently exclude a fourth matching profile or resolve a conflict.

Check proposed wording for private or case-specific content before accepting it. Local filters and model instructions reduce accidental reuse, but they cannot establish complete personal-data removal or professional correctness. An observed convention is evidence of that sample's style, not proof that it is legally or linguistically correct.

Deleting a sample previews affected rules. Choose whether rules dependent solely on it should remain independent or be deactivated. Already inactive rules remain inactive. Sample files are removed from the current collection; approved rules retain only minimal origin references. Existing encrypted backups and retained recovery points have their own retention and deletion lifecycle.

## Manage and select rules

**Learning → Rules** shows the same accepted rules and pending proposals as Foli. Filter by state, category, origin, language and document type. Rules can be edited, duplicated, permanently switched or deleted. Independent adoption of a sample rule is an explicit choice. Chat deletion does not delete accepted rules.

The **Rules** button beside **Translate** shows the server's selection for the next job. Some applicability can remain unknown before source-language/document-type detection. Each skipped or blocked rule has a reason. Switching a rule off only for that job does not permanently disable it; permanent switches are separate. Temporary next-job exceptions reset after successful enqueue.

Typed settings cover supported line/paragraph spacing, margins, heading alignment, table proportions, row keeping and page numbering. Normal Word text still requests Aptos 11, and original pages remain in the PDF annex. Actual PDF fonts depend on available licensed fonts and the export runtime's substitution behavior. Rules cannot enable arbitrary code, change the fixed body-font requirement or remove the original annex.

Explicit job choices take precedence. A narrower matching scope overrides a broader rule only for its own properties. Origin alone gives no priority: sample, manual and chat rules share one resolver. Conflicting equally applicable rules require a decision. Template/profile values fill properties not set by approved rules. Free-text conflicts cannot all be detected automatically.

Terminology uses the existing glossary. A new pair remains proposal data until explicit acceptance commits both its rule and glossary entry. Disabling or excluding a managed terminology rule prevents its glossary pair from bypassing the rule selection. Conflicting pairs use the existing per-job glossary decision flow.

## Existing translations

New jobs freeze available rule versions. Later global changes do not enter their sections, clarification answers or resumed revisions. Existing results are not rewritten in the background.

In a finished translation, choose **Apply current rules** to preview a deliberate new selection. Resolve any questions first. Layout-only changes rebuild PDF and Word locally; changed wording, field order or effective terminology uses that job's model and can consume quota or API budget. The selected context stays frozen through interruption and continuation.

The result is a revision proposal. Accept it through the existing review controls to create a new version. Until then, the current files stay unchanged. Up to ten recent result versions are retained for restoration, subject to the job's existing archive/retention policy. Every applied rule is traceable to its saved ID and version.

## Consumption, storage and updates

An explicitly sent Foli message makes at most one model request. Rule management, proposal acceptance and rule previews do not make model requests. Foli appears as its own usage category. API token/cost information is shown only when available and remains an estimate rather than a provider invoice. ChatGPT remaining quota is not invented when the integration does not report it.

The existing API budget and explicit consent for unknown estimates also apply to Foli. A cancelled or interrupted dispatched request can already have used quota. Foliquo does not automatically resend it after restart; a new attempt requires deliberate action and, for uncertain outcomes, confirmation. A full conversation can be replaced with a new one; conversation and proposal retention are bounded.

Rules, approvals, profiles and chat records belong to the encrypted per-user data directory, outside the app installation. They are local to that workspace, not account-wide synchronization. Normal updates preserve that directory and its key. A schema upgrade protects new data against silent rewriting by an older incompatible release; do not use an old app as a downgrade editor for the upgraded workspace.

Encrypted backups include rules and profiles. **Include chat history** is enabled by default and can be switched off without excluding accepted rules or profiles. Deleting chat history and deleting rules are separate actions. Clearing reviewed proposal history retains accepted rules and sample rejection history. Provider credentials are not exported in a backup. Keep the backup password separately; same-device recovery points do not replace an external backup.

See [desktop setup and updates](https://github.com/gitmaximilian/Foliquo/blob/main/docs/DESKTOP-APPS.md) and [browser/CLI data paths](https://github.com/gitmaximilian/Foliquo/blob/main/docs/BROWSER-SETUP.md). Automatic output still requires qualified human review and, where required, certification by an authorized professional.
