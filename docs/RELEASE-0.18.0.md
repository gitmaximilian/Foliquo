# Foliquo Community v0.18.0

A cleanup of the whole interface: one consistent type scale and control size, and almost no fold-out sections.

## Calmer, consistent interface

- One type scale everywhere: page titles 24 px, section titles 18 px, group titles 15 px, body text 14 px, notes 13 px, captions 12 px. Text previously ranged from 11 to 16 px depending on the view.
- Buttons, fields and dropdowns share one size: 14 px text at 44 px height. Fields previously ranged from 40 to 46 px.
- The document viewers (original and translation) have one quiet tool row. "Markierung" only appears when there is a marked area, and "Gesamten Text kopieren" is now "Text kopieren".
- The step bar in the question dialog spans the full width and is no longer cut off.
- In Settings, the spending limit field and its save button sit on one row.

## Fewer fold-outs

- Informational sections are always open and read as titled sections: review checks, use abroad, notes in the style area, and the tools dialog. You no longer need to click "▶ text" to see what is there.
- Only optional forms and menus still fold, such as extra information, a new term, rules for a new version, single formats and individual model calls. They now show as a button with a chevron.
- Upload limits are shown as a short caption below the upload area.

## Fixes

- Private dossiers: the "Person im Dossier" and "Art der Angabe" labels stay in the chosen interface language instead of sometimes appearing in English. "Art der Angabe" preselects "Eigene Angabe" instead of showing an empty field.
- Revisions are faster: the source pages placed in the Word file are rendered once per document and reused for later versions, instead of being rendered again on every change.
- Tests on Windows use free ports assigned by the operating system.

## Also in this release (prepared as 0.17.1)

Changes are applied as intended, and the Word download carries the original.

### Requested changes

- A requested change now appears directly below the request form as a suggestion. It shows a before and after for each changed passage.
- You choose the passages to keep and select **Apply** (or **Apply 2 of 3**). **Discard** keeps the current version. An applied change becomes a new version.
- If a suggestion changes confirmed values such as names or dates, the panel lists them. Applying confirms the new values; no hidden unlock option is needed anymore.
- Previously, the send button said "apply" but only created a suggestion inside the tools dialog. Applying could also fail without a clear reason when protected fields were touched.

### Word download with the original

- The Word file now carries the source pages after the translation, like the PDF. They sit in a separate section without the certification header.
- Word files of earlier results are rebuilt once when you download them.

### Layout

- Checked every main view (translate, library, style, Foli, guide, review, questions, settings, queue) at widths from 360 to 2560 pixels. No horizontal scrolling or clipped text was found, and left and right margins match.
- The desk card spans the page width and shows a status icon that matches the job (finished, question, failed, cancelled, running).
- Review page: the download row, notice and certification options line up in one grid. The step indicator in the question dialog stays on one line. Answer buttons align to the start.
- Narrow windows: labels around checkboxes and radio buttons, and library file names, are at least 32 pixels high. Foli's example prompts sit in one swipeable row, so the conversation keeps its room.

## Practical limits

Model output, OCR, notes and reconstructed layouts still require review. Foliquo never sets a seal or signature and does not certify.
