# Features and limitations

Foliquo is a local browser application for preparing translation drafts from images, PDFs, and Word documents. It is not a certified translation service.

## Workflow

1. Add one or more document files, such as the front and back of an ID.
2. Choose the target language and add optional facts such as a confirmed Latin spelling.
3. Translate. Source language and document type are detected automatically.
4. Answer focused questions if a value is unclear. An unreadable answer can be accepted as unreadable.
5. Download PDF and editable Word, or open the optional side-by-side review and editing tools.

Each completed job is grouped in the library by detected document type. The optional Learn Style tab stores examples locally and derives reusable formatting and phrasing conventions. It is not model training and personal facts are not reused.

Stamps and seals are laid out as bordered blocks with their line breaks preserved. Translate their readable words without square brackets; use brackets for non-text emblems, logos, and signatures. An illegible signature mark is written as `[Unterschrift: unleserlich]`.

## Providers and data

ChatGPT sign-in uses the account authorization flow. OpenAI, Claude, and DeepSeek API keys are stored in the encrypted local workspace. Provider API use may be billed separately. Source documents are sent to the selected model provider only when a translation or model-assisted action is requested. The local server binds to loopback and is not a hosted multi-user service.

## Free delivery

Browser and CLI releases remain available for Windows, macOS, and Linux. Native desktop apps for macOS Apple Silicon/Intel, Windows x64, and Linux x64 are available as direct downloads. They bundle Node.js and LibreOffice. The macOS apps are unsigned, Windows installers may show SmartScreen, and Linux is distributed as a Flatpak bundle. See the [desktop setup guide](docs/DESKTOP-APPS.md) for current packages and installation details.

The app's update check is read-only and sends no workspace content to GitHub.

## Review limits

OCR and language models can omit, misread, or invent information. Users must compare the output with every source page. An automated draft does not constitute a legally valid or certified translation. An authorized translator must perform the required review and certification. Date formatting is normalized to `DD.MM.YYYY` where the source makes the date clear; ambiguity should be clarified, not guessed.
