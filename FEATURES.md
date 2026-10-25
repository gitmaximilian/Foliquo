# Features and limitations

Foliquo is a local browser application for preparing translation drafts from images, PDFs, and Word documents. It is not a certified translation service.

## Workflow

1. Add one or more document files, such as the front and back of an ID.
2. Choose the target language and add optional facts such as a confirmed Latin spelling.
3. Translate. Source language and document type are detected automatically.
4. Answer focused questions if a value is unclear. An unreadable answer can be accepted as unreadable.
5. Download PDF and editable Word, or open the optional side-by-side review and editing tools.

Each completed job is grouped in the library by detected document type. The optional Learn Style tab stores examples locally and derives reusable formatting and phrasing conventions. It is not model training and personal facts are not reused.

## Providers and data

ChatGPT sign-in uses the account authorization flow. OpenAI, Claude, and DeepSeek API keys are stored in the encrypted local workspace. Provider API use may be billed separately. Source documents are sent to the selected model provider only when a translation or model-assisted action is requested. The local server binds to loopback and is not a hosted multi-user service.

## Browser-only delivery

The repository provides one setup and one browser launcher for Windows, macOS, and Linux. No native desktop installer or installable PWA is published. The setup may install Node.js and LibreOffice through the system package manager; both are needed by the local service for its full document workflow.

The app checks GitHub Releases for updates and links to the new source ZIP. The user reruns setup after replacing source files; `.local` must be preserved. Update checks send no workspace content to GitHub.

## Review limits

OCR and language models can omit, misread, or invent information. Users must compare the output with every source page. An automated draft does not constitute a legally valid or certified translation. An authorized translator must perform the required review and certification. Date formatting is normalized to `DD.MM.YYYY` where the source makes the date clear; ambiguity should be clarified, not guessed.
