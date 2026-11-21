# Foliquo Community v0.17.1

This update fixes how requested changes are applied, puts the original document into the Word download, and tidies the layout at every window size.

## Requested changes

- A requested change now appears directly below the request form as a suggestion. It shows a before and after for each changed passage.
- You choose the passages to keep and select **Apply** (or **Apply 2 of 3**). **Discard** keeps the current version. An applied change becomes a new version.
- If a suggestion changes confirmed values such as names or dates, the panel lists them. Applying confirms the new values; no hidden unlock option is needed anymore.
- Previously, the send button said "apply" but only created a suggestion inside the tools dialog. Applying could also fail without a clear reason when protected fields were touched.

## Word download with the original

- The Word file now carries the source pages after the translation, like the PDF. They sit in a separate section without the certification header.
- Word files of earlier results are rebuilt once when you download them.

## Layout

- Checked every main view (translate, library, style, Foli, guide, review, questions, settings, queue) at widths from 360 to 2560 pixels. No horizontal scrolling or clipped text was found, and left and right margins match.
- The desk card spans the page width and shows a status icon that matches the job (finished, question, failed, cancelled, running).
- Review page: the download row, notice and certification options line up in one grid. The step indicator in the question dialog stays on one line. Answer buttons align to the start.
- Narrow windows: labels around checkboxes and radio buttons, and library file names, are at least 32 pixels high. Foli's example prompts sit in one swipeable row, so the conversation keeps its room.

## Practical limits

Model output, OCR, notes and reconstructed layouts still require review. Foliquo never sets a seal or signature and does not certify.
