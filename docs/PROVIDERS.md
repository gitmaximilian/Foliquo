# AI providers

TranslateOCR supports ChatGPT account authorization and API keys for OpenAI, Anthropic Claude, and DeepSeek. The ChatGPT account flow is not an API-key integration; API providers may bill separately.

Keys are stored in the encrypted `.local` workspace and never returned to the browser. Backups omit provider credentials. A provider receives source documents only when the user asks it to process a job, answer a clarification, or revise text. The connectivity check contacts provider endpoints without uploading documents.

Open **AI** in the header to choose a provider, sign in or save its API key, and select an available model. The first-run tour includes these same live controls in its model step. Continue after a connection and model are available, or explicitly choose **Set up later**. The tour resumes at this step after returning from sign-in. Connection management and diagnostics are available in the same header dialog. Check the provider's current data-retention and billing terms before using real documents. TranslateOCR is a local single-user workspace, not an account service for multiple users.

Clarification suggestions are candidates until explicitly selected. Choosing a suggestion confirms that question immediately. Choosing **Unreadable** records a final source-illegibility marker rather than inventing a value, including for names. Other draft answers remain saved until submitted.
