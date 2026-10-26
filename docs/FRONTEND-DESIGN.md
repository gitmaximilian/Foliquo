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
