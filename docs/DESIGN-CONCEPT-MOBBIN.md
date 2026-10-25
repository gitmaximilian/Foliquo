# Interface design notes

Foliquo uses a restrained document-workbench layout: a centered header, balanced upload and settings panels, clear spacing, and a compact footer. Primary actions are centered and consistent. The UI avoids promotional filler and exposes detailed review controls only when needed.

The main workflow should make upload, target language, provider status, queue progress, and final PDF/Word downloads easy to find. The library groups jobs by detected document type. Connection diagnostics belong inside the AI-provider area; technical job diagnostics stay collapsed by default.

English, German, and Arabic share the same component layout. Arabic text uses right-to-left direction while the Foliquo wordmark stays left-to-right and is not mirrored. Responsive layouts stack cards without forcing horizontal scrolling. Keep focus states, labels, keyboard access, and reduced-motion behavior intact.
