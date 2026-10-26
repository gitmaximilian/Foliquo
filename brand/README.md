# Foliquo brand assets

Foliquo uses the approved geometric F monogram and lowercase wordmark. The two editions share the same silhouette and differ only in the treatment of the mark:

- **Standard** uses the filled mark.
- **Community** uses the outlined mark with transparent interiors.

The source artwork, PNG exports, favicons and tokens are in `standard/` and `community/`. `code/FoliquoLogo.tsx` is the shared React reference component; `code/brand.css` contains reusable brand styles. The browser application serves the same edition assets from `dist/brand/` and selects its Community identity with `data-brand-edition="community"`.

Do not redraw, stretch or recolor the artwork. Use the light or dark variant that provides sufficient contrast. The workspace uses Manrope and a neutral interface palette around the brand's blue accent.
