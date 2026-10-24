# Fictional demo

The `/demo/` route shows a scripted example flow in English, German, and Arabic. Its driving-licence sample is fictional, visibly labelled, and does not call an AI provider. The demo includes generated PDF and Word examples for each language.

Use the `Demo` link in the header to open the demo. Use its return-to-TranslateOCR control to go back to the regular workspace. The onboarding tour also offers the demo and can be skipped.

Never use a real identity document in a public demo, screenshot, test fixture, or release artifact.

## Public website

Try the hosted [interactive demo](https://maximilianauer.at/projects/translateocr/demo/?lang=en), or read the [project story](https://maximilianauer.at/projects/translateocr/). The public demo returns to the project page; the demo running inside the local application returns to its workspace.

To publish the fictional demo files to an existing static website, use `node scripts/export-public-demo.mjs <destination>`. See [presentation maintenance](PRESENTATION.md).
