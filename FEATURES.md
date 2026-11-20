# Features and limitations

Foliquo is a local browser application for preparing translation drafts from images, PDFs, and Word documents. It is not a certified translation service.

## Workflow

1. Add one or more document files, such as the front and back of an ID.
2. Choose the target language and add optional facts such as a confirmed Latin spelling.
3. Translate. Source language and document type are detected automatically.
4. Answer focused questions if a value is unclear. An unreadable answer can be accepted as unreadable.
5. Download PDF and editable Word, or open the optional side-by-side review and editing tools.

Each completed job is grouped in the library by detected document type. The optional Learn Style tab stores examples locally and derives reusable formatting and phrasing conventions. It is not model training and personal facts are not reused.

Stamps and seals are laid out as bordered blocks with their line breaks preserved. Translate their readable words without square brackets; use brackets for non-text emblems, logos, and signatures. Notes for non-text elements follow the target language. For example, an illegible signature mark is written as `[Unterschrift: unleserlich]` in German, `[Signature: illegible]` in English and `[توقيع: غير مقروء]` in Arabic. Model-authored clarification questions use the current interface language.

## Certified translations (Austria)

Foliquo follows the ÖVGD guideline for court-certified translations (12/2024); see [the mapping](docs/CERTIFICATION-GUIDE-MAPPING.md). A one-time certification profile stores the place, the translator's listed languages, a bilingual clause option and the usual source form and route. The review page then shows the header and the clause as they will be exported:

- Header "Beglaubigte [auszugsweise] Übersetzung aus der … Sprache in die … Sprache" with a line in the other language of the pair.
- Clause in the § 190 AußStrG wording for an attached or presented original, an attached copy or an attached certified copy, at the actual end of the text after a rule, with place and production date, a labelled English or Arabic version where it applies, and 5 cm reserved for seal and signature.
- Warnings for a missing place, unlisted languages, relay pairs, blank runs, signatures missing from the text and plain copies.
- A checklist after download for the paper route (connection, seal, corrections), the electronic route (sign the exported PDF with ID Austria outside Foliquo) and use abroad.

Foliquo never sets a seal, a handwritten or an electronic signature and does not certify. The checklist is information, not legal advice.

## Providers and data

ChatGPT sign-in uses the account authorization flow. OpenAI, Claude, and DeepSeek API keys are stored in the encrypted local workspace. Provider API use may be billed separately. Source documents are sent to the selected model provider only when a translation or model-assisted action is requested. The local server binds to loopback and is not a hosted multi-user service.

## Free delivery

Browser and CLI releases remain available for Windows, macOS, and Linux. Native desktop apps for macOS Apple Silicon/Intel, Windows x64, and Linux x64 are available as direct downloads. They bundle Node.js and LibreOffice. The macOS apps are unsigned, Windows installers may show SmartScreen, and Linux is distributed as a Flatpak bundle. See the [desktop setup guide](docs/DESKTOP-APPS.md) for current packages and installation details.

The app's update check is read-only and sends no workspace content to GitHub.

## Review limits

OCR and language models can omit, misread, or invent information. Users must compare the output with every source page. An automated draft does not constitute a legally valid or certified translation. An authorized translator must perform the required review and certification. Date formatting is normalized to `DD.MM.YYYY` where the source makes the date clear; ambiguity should be clarified, not guessed.
