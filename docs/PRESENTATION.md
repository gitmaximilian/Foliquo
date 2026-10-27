# Project presentation

The repository presents Foliquo through a restrained cover, an actual workspace screenshot, a short workflow, and direct demo / download / setup links. The website at https://maximilianauer.at/projects/foliquo/ provides an English-first project story with a German switch.

## Visual direction

Reference patterns were reviewed from Nim, Magic Portfolio, Magic UI Portfolio, Chronark, Sidefolio, Dub, Midday, Twenty, Documenso, Shadcn Landing Page, Next Shadcn Dashboard and Motion Primitives. The presentation uses the shared principles: quiet typography, clear hierarchy, a prominent product preview, concise navigation and subtle motion. No template source, logos or third-party screenshots were copied.

GitHub READMEs support Markdown and a limited HTML subset, so the cover and screenshots provide the visual identity. Interactive controls belong in the linked public demo.

## Public demo

```sh
npm run demo:build
node scripts/export-public-demo.mjs /absolute/path/to/site/projects/foliquo/demo
```

The exporter copies only the explicit fictional demo files and changes its return link to the project story. It never packages application code, server routes, provider credentials, local uploads or workspace data. The local application keeps its original return-to-workspace behavior.

## Updating the presentation

1. Keep all repository copy in English.
2. Capture only fictional fixture documents; never capture a user's real job or account details.
3. Refresh `docs/images/workspace-current.jpg` and `docs/images/source-review.jpg` when the interface changes.
4. Rebuild and export the demo, then check English, German and Arabic through all four steps and downloads.
5. Publish the static portfolio output to the existing Cloudflare Pages project. Check the project entry, case study, demo return link, mobile layout, light/dark theme and language switch.
6. Push repository changes after checking the published links.
