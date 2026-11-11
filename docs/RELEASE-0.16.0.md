# Foliquo Community v0.16.0

This version redesigns the interface around the document: a desk of recent documents in the studio, a review page that starts with the original and the translation, and one place for settings. Translation, export and storage behave as in 0.15.0. It remains a local Community application; professional review is required.

## Changes

- New look: ink-blue primary actions, a warm canvas, larger text and status chips that show each document's state at a glance.
- The studio shows a desk of recent documents with their state and the next action, such as answering questions, reviewing or retrying. The side panel is now called Queue.
- Clarification and review show a step bar: read, clarify, translate, review, export.
- The review page opens with the original and the translation side by side. Checks compare the source value with the translated value, show progress, and can be walked with J and K.
- The library shows documents as archive cards with state chips. Library and Foli have guiding empty states.
- One header entry opens all settings: AI provider, budget, storage and updates.
- Style tools are grouped in the sidebar, the style tabs link to Foli, and English and German use one term for style samples ("example", "Muster").
- The guide's quick start is a checklist that ticks off the first steps as you complete them.
- The name in onboarding is optional.

## Security and data

No changes to data handling. Data stays in the encrypted per-user workspace outside installation directories. Original files remain unchanged. No new data is sent to providers or GitHub.

## Downloads and updates

Downloads and updates work as in 0.15.0. Desktop update packages use the existing updater signatures and public keys; browser/CLI distributions and Homebrew remain available through their separate paths.

## Practical limits

These changes do not train model weights or certify linguistic accuracy. Model output, OCR, notes and reconstructed layouts require review. Pixel-identical output across systems is not promised; Word requests Aptos 11 while the local PDF runtime may substitute a font.
