# Foliquo Community v0.16.0

This version redesigns the interface around the document, writes translation notes in the target language, asks clarification questions in the interface language, and hardens the local service. It follows 0.14.1 and includes all changes prepared for 0.15.0, which was not published separately. It remains a local Community application; professional review is required.

## Interface

- New look: ink-blue primary actions, a warm canvas, larger text and status chips that show each document's state at a glance.
- The studio shows a desk of recent documents with their state and the next action, such as answering questions, reviewing or retrying. The side panel is now called Queue.
- Clarification and review show a step bar: read, clarify, translate, review, export.
- The review page opens with the original and the translation side by side. Checks compare the source value with the translated value, show progress, and can be walked with J and K.
- While review checks are open, the download bar leads to the next open check. PDF, Word and PDF + Word stay available.
- The library shows documents as archive cards with state chips. Library and Foli have guiding empty states.
- One header entry opens all settings: AI provider, budget, storage and updates.
- Style tools are grouped in the sidebar, the style tabs link to Foli, and English and German use one term for style samples ("example", "Muster").
- The guide's quick start is a checklist that ticks off the first steps as you complete them. The name in onboarding is optional.
- The clarification dialog has one primary action, an app-styled image upload, and translated controls in English and Arabic.
- On phones the navigation is one scrollable row, so uploading is visible without scrolling.

## Translation workflow

- Translations into English, Arabic, French, Spanish, Italian and Turkish use notes in their own language, for example `[Signature: illegible]`, `Stamp:` or `[توقيع: غير مقروء]`. German output is unchanged. English document titles now read "Certified translation from … into English"; French, Spanish, Italian and Turkish titles are localized, and Arabic titles name the source language in Arabic.
- Model-authored clarification questions use the current interface language (English, German or Arabic).
- Selecting text on an original image works again; local text recognition had not started in the browser.
- Claude 4 and later models may return longer translations when the provider reports no output limit.

## Security and data

- Every state-changing local request now requires the same origin and the session token, including batch, dossier and budget-consent routes.
- Local pages send a Content-Security-Policy that limits scripts, workers and requests to the local service.
- Data stays in the encrypted per-user workspace outside installation directories. Original files remain unchanged. No new data is sent to providers or GitHub.

## Downloads and updates

Windows and Linux desktop builds bundle a smaller LibreOffice copy without spreadsheet, presentation, drawing and database modules. The build keeps this copy only after confirming that export and upload conversions produce identical PDF page content; otherwise it bundles the complete copy. The macOS app keeps the unmodified LibreOffice. Desktop update packages use the existing updater signatures and public keys; browser/CLI distributions and Homebrew remain available through their separate paths.

## Practical limits

These changes do not train model weights or certify linguistic accuracy. Model output, OCR, notes and reconstructed layouts require review. Pixel-identical output across systems is not promised; Word requests Aptos 11 while the local PDF runtime may substitute a font.

See the [review record](https://github.com/gitmaximilian/Foliquo/blob/v0.16.0/docs/REVIEW-2026-11.md) for findings, changes and evidence.
