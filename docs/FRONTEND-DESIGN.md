# Foliquo interface design

## Direction

The Community workspace is a focused document atelier. Translation remains the first destination; a compact language bar leads into the upload surface, while provider and optional context controls stay together in a secondary options panel. A persistent rail keeps the library, style examples, guide and active jobs reachable without competing with the upload task.

## Visual system

The interface uses Manrope, the approved Foliquo Community monogram and wordmark, cool charcoal surfaces, restrained blue selection states, and high contrast control outlines. Shared CSS tokens define canvas, surface, text, borders, focus, status colors, spacing, radii, shadows and motion. Use those tokens for new controls rather than introducing page-specific palettes.

The light and dark themes share the same semantic token names. Theme selection is persisted locally. Motion is limited to short state feedback and honors `prefers-reduced-motion`.

## Interaction and accessibility

- Source and target labels remain available to assistive technology while their visible text stays hidden.
- Language selection and swapping use native buttons/selects with visible keyboard focus.
- Upload supports file browsing, drag and drop, multiple documents, replacement/removal and page-role assignment.
- Options and less common controls use disclosure or dialogs. Status and error messages use live regions.
- Layout changes at narrow widths: the rail becomes compact, language controls stack, upload remains full width, and the options panel follows the primary action.
- Buttons retain semantic names independent of icon artwork; touch controls have comfortable hit areas.

## Component map

`dist/index.html` owns the application landmarks and page structure. `dist/style.css` contains shared components and responsive layouts; `dist/theme.css` supplies the token-based theme; `dist/theme.js` restores the selected theme before paint. The existing feature scripts own upload, providers, jobs, review, the library and style examples. `server.mjs` serves only the explicit UI asset map and bounded brand asset paths.
## Public demo and GitHub presentation

The guided public demo uses the same Manrope typography, Community branding, charcoal/blue surfaces, light theme and focus treatment as the application. Its four-step rail becomes a horizontal progress strip below the compact mobile header. Document pages stay white in both themes. The sample card only selects the provided fictional document; it never implies support for real uploads or makes a model request.

The existing scripted clarification, staged edit, optional checklist, source/translation comparison and PDF/Word/ZIP downloads remain available in English, German and Arabic. Interface theme and locale are local preferences; the legacy locale key remains readable. Native controls, current-step semantics, pressed view states, live feedback and focus after step transitions support keyboard users. Reduced motion disables smooth scrolling.

`dist/demo/` is the canonical source for both the local and public demo. `scripts/export-public-demo.mjs` copies only the public demo and fictional assets to the portfolio route. Its small self-contained brand/font assets avoid dependencies on the full app server. Both legacy and current website URLs are published together; the legacy URL redirects to the current route.

The README banner uses `docs/images/cover.png`, rendered from `cover.svg` with the approved Community wordmark PNG at its original proportions. No old book glyph or hand-typeset replacement wordmark is layered over the logo. README artwork and demo links share the stable public demo URL.
