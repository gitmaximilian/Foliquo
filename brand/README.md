# Foliquo brand assets

The Foliquo mark is **Glasblätter**: two overlapping pages, the original and its translation, with three text lines on the front page. The lowercase wordmark is set in Manrope Bold. The two editions share the same geometry and differ only in finish:

- **Community** (used by the workspace) gives the pages translucent glass gradients: blue `#7FB2FF → #2F6BFF` behind, violet `#C4A6FF → #7C3AED` in front at 78 % opacity.
- **Standard** uses flat fills: blue `#2F6BFF` behind, violet `#7C3AED` in front at 86 % opacity.

Monochrome variants (black, white) drop the text lines. Favicons at 32 px and below drop them too, so the mark stays legible.

Every SVG, PNG, favicon, the browser logo component (`dist/brand/foliquo-logo.js`), the demo assets and the desktop icons are generated from one master by `node scripts/build-brand.mjs`. Change the geometry or colours there, never in the generated files. `code/FoliquoLogo.tsx` is the matching React reference component; `code/brand.css` contains reusable brand styles. The browser application serves the edition assets from `dist/brand/` and selects Community with `data-brand-edition="community"`.

Do not redraw, stretch or recolor the artwork. Use the light or dark variant that provides sufficient contrast.
