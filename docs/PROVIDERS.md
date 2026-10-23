# AI providers

TranslateOCR supports ChatGPT account authorization and API keys for OpenAI, Anthropic Claude, and DeepSeek. The ChatGPT account flow is not an API-key integration; API providers may bill separately.

Keys are stored in the encrypted `.local` workspace and never returned to the browser. Backups omit provider credentials. A provider receives source documents only when the user asks it to process a job, answer a clarification, or revise text. The connectivity check contacts provider endpoints without uploading documents.

Choose a provider in the AI connection panel, complete its sign-in or save its API key, then select an available model. Check the provider's current data-retention and billing terms before using real documents. TranslateOCR is a local single-user workspace, not an account service for multiple users.
