# AI connection verification — 0.11.2

## Root cause and repair

The released UI awaited GET /api/studio-draft before showing its provider controls, but that route did not exist. The HTTP 404 interrupted initialization, leaving only “Open locally” pointing to the same local page. Both private draft routes now exist, and draft restoration is isolated from provider initialization. Drafts use the existing encrypted workspace, are scoped to the browser session, validate file/metadata limits, and expire after 30 days or session removal.

## Evidence

| Path | Verification | Limit |
| --- | --- | --- |
| Local UI | Actual installed 0.11.1 backend, with the corrected UI, initializes successfully despite its missing draft route. AI controls and model selector remain visible. | Full persistent-draft implementation is in 0.11.2. |
| ChatGPT sign-in | User completed account choice and authorization in OpenAI's actual browser flow. Local session reports connected and planEnabled; eight real models loaded. | Account/plan eligibility remains controlled by OpenAI. |
| ChatGPT inference and exports | A real gpt-6.1-sol request translated a fictional English TXT document into German. A real 836273-byte PDF and 2704-byte Word document were generated. | This validates connectivity, not translation quality or certification. |
| OpenAI API | Automated authenticated model/request contract, model filtering, invalid credentials and cache-refresh tests. | No real API key supplied; live success and billing not tested. |
| Anthropic API | Automated Models/Messages/PDF/image contract and per-model output-limit tests. | No real API key supplied; live success and billing not tested. |
| DeepSeek API | Actual authenticated Models API is now required; automated invalid-key rejection, Responses API streaming and local PDF-to-image conversion tests. | No real API key supplied; live success and billing not tested. |
| Regression suite | 140 tests passed; offline benchmark: three cases, zero regressions; acceptance checks and demo build passed. | Synthetic tests are separate from live calls. |
| Layout | Theme action placed directly above language; desktop swap clearance 16px; matching adjacent connection buttons with aria-expanded and independent panels. | Mobile wrapping is intentional. |

## Local follow-up layout changes

Tasks 5–7 add a compact circle-minus disabled cursor (including disabled descendants), a compact jobs empty state with a document icon and local-storage footer, and a matching options panel with separate provider/model/status lines. Browser inspection confirmed the cursor declaration, no horizontal overflow and the real connected ChatGPT state. These visual changes received a short manual check, without another full test run.

The installed Homebrew application has a reversible local patch, with original application files backed up outside its installation. Backend restart preserved ChatGPT credentials and made the draft endpoint available. The new official version/release has not been published.

## Official contracts consulted

- [OpenAI registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [OpenAI vision inputs](https://developers.openai.com/api/docs/guides/images-vision)
- [Anthropic model catalog](https://platform.claude.com/docs/en/api/models/list)
- [DeepSeek Responses and image input](https://api-docs.deepseek.com/guides/responses_api/)

No API keys, OAuth tokens, real documents or private workspace contents are included in this report. Test fixtures were fictional. Existing credentials remain in the same private data directory during the update.
