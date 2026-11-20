# Certification guide mapping

This document maps the ÖVGD guideline "Richtlinien für die richtige Herstellung von gerichtlich zertifizierten Übersetzungen" (Österreichischer Verband der allgemein beeideten und gerichtlich zertifizierten Dolmetscher:innen, version of 12 December 2024) to Foliquo. The guideline itself is not part of this repository; references name its sections (A–G) and paragraphs. It is a professional association guideline, not a statute; where it cites law (§ 190 AußStrG, SVG, eIDAS, Hague Apostille Convention), this document only repeats the reference.

Foliquo prepares drafts. It never sets a seal, a handwritten or electronic signature, never certifies, and does not claim legal compliance. The certified translator decides, prints or signs, and connects the documents.

Categories:

- **a** Foliquo produces it automatically in the export.
- **b** Foliquo checks it and warns before the final export.
- **c** Foliquo explains it (checklist or note); the person carries it out.
- **d** Remains an explicit human task; Foliquo does not do it.

Status before this change refers to 0.16.1 (`f9f9314`). Status after refers to this branch; evidence names the test or code.

| # | Requirement | Guide | Cat. | Before (0.16.1) | After |
| --- | --- | --- | --- | --- | --- |
| 1 | Only translators on the court list may certify; the listing is limited to five years. | A (1)–(4) | d | Guide view says only authorised persons certify. | Unchanged; certification profile records the translator's own languages, no list check. |
| 2 | Clause wording per § 190 AußStrG: "Die genaue Übereinstimmung der vorstehenden Übersetzung mit dem – angehefteten – vorliegenden – beglaubigten – Original / der angehefteten – beglaubigten – Kopie – bestätige ich unter Berufung auf meinen Eid." | B (2) | a | Missing. The export option "insert configured certification text" existed, but no UI could set the text, so nothing was inserted. | Clause generated from fixed wording and the chosen variant (attached or presented original, attached copy, attached certified copy). `tests/certification.test.mjs` |
| 3 | Place and production date are part of the clause; seal and signature follow. | B (2) | a + d | Missing. | Place from the certification profile, date of the final export (DD.MM.YYYY) as part of the clause; free space for seal and signature below. Seal and signature stay human (d). |
| 4 | Clause at the actual end of the translation text, not at the end of the last sheet; blank space before it voided by a line. | B (3) | a | Missing. | Clause follows the last text block, preceded by a full-width rule; kept together with its date line. `tests/certification.test.mjs` (DOCX order and rule) |
| 5 | Space-saving clause so a court can add an intermediate certification. | B (6) | a | Missing. | Compact clause (two short paragraphs plus place/date); no page break forced. |
| 6 | Clause recommended in both languages. | B (7) | a (EN, AR) / c | Missing. | German clause plus a labelled English or Arabic version when one side of the pair is English or Arabic; other languages German only (stated in the export panel). |
| 7 | Seal: round seal 3.5–4.5 cm with name, title, languages; no national emblem. | C (1) | d | Not covered. | Reserved blank area of 5 cm under the clause so seal and signature do not cover text; seal design stays the translator's task. |
| 8 | Signature must not cover text and must match the specimen. | C (3) | a (space) + d | Not covered. | Reserved area as in 7. |
| 9 | Electronic signature replaces seal and handwritten signature; requires ID Austria; only valid electronically; not for intermediate certification or apostille. | C (5) | c + d | Guide view mentions merging before signing. | Electronic route checklist: export the PDF (translation followed by the source pages), sign it with ID Austria outside Foliquo, any later change voids the signature, not usable for intermediate certification or apostille. |
| 10 | Date, clause, seal and signature are needed for public faith. | D (1) | a + d | Partly (no clause). | Covered by 2–8. |
| 11 | Translation inseparably connected to the source; digital: merged with the source PDF. | D (2), E (1)–(4) | a (PDF) + c | The PDF always appends the source pages after the translation. | Unchanged PDF order; paper checklist covers staple or thread, vignette and seal across both documents; electronic checklist covers the merged PDF. |
| 12 | Domestic use: a copy may be attached; foreign use: the original (or a notarised copy) is attached. | D (2) a–b | c | Not covered. | Export panel note depends on the chosen source form; abroad route lists the requirements and advises asking the receiving authority. |
| 13 | Only listed languages; relay translations need a translator listed for that pair. | D (3) | b | Not covered. | Warning when the non-German language of the pair is not in the profile, or when neither side is German (relay hint). |
| 14 | Wording must match the source; layout adapted to the source. | D (3) | a + d | Prompt requires complete wording and source layout; review checks. | Unchanged. |
| 15 | Header "Beglaubigte Übersetzung aus der … Sprache in die … Sprache", bilingual. | D (4) | a | German header used "aus dem Arabischen ins Deutsche"; only Arabic→German had a second language line; English and other targets had a single foreign-language line. | German line in the guide's wording plus a line in the other language of the pair when that language is English, Arabic, French, Spanish, Italian or Turkish. `tests/certification.test.mjs` |
| 16 | Partial translation marked "Beglaubigte auszugsweise Übersetzung …". | D (4) | a | Missing. | "Excerpt" choice in the export panel changes both header lines. |
| 17 | No larger blank spaces; necessary ones marked with a line or note. | D (5) | a + b | Prompt asks to avoid unmarked blank space. | Before the final export, runs of three or more empty lines are reported with their position. |
| 18 | Logos, coats of arms, signatures, stamps and seals described in square brackets and fully translated; never copied as images. | D (6) | a | Target-language notations in brackets; stamps as text blocks; source images are never placed inside the translation. `tests/target-notations.test.mjs` | Unchanged. |
| 19 | Photos may only be inserted by the translator. | D (6) | d | Not inserted. | Unchanged; stated in the paper checklist. |
| 20 | Corrections after printing confirmed with date and signature. | D (7) | c | Not covered. | Paper checklist item. |
| 21 | No notarial functions; nothing may be added to the translation afterwards; client to be told. | D (8) | c | Not covered. | Checklist note for the client hand-over. |
| 22 | Signatures in the source translated with legible name or "Unterschrift unleserlich". | D (9) | a + b | Notation enforced for unreadable signatures. `tests/target-notations.test.mjs` | Unchanged; before the final export, signature regions without a matching notation in the text are reported. |
| 23 | Permanent connection; listed non-permanent methods are not acceptable; never hand out the translation unconnected. | E (1)–(5) | c | Not covered. | Paper checklist with the acceptable and non-acceptable methods. |
| 24 | Legalisation route: intermediate certification (Landesgericht), BMEIA, foreign mission; apostille in two steps for Hague states; no apostille on the translator's signature alone. | F, G | c | Guide view links BMEIA. | Abroad checklist with the steps and the advice to confirm requirements with the receiving authority first. Fees are not shown because they change. |

## Evidence

Tests named above run in `npm test`. The export panel, checklists and warnings are covered by `tests/browser/certification-export.spec.mjs`.
