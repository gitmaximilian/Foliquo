# Local scan review and working copies

The optional scan dialog uses the existing source viewer and correction API. Diagnostic checks never call a provider, perform OCR or change a document. A completed local check is not a reading-quality guarantee. The user may inspect the original, choose a better source, prepare a reversible working copy or continue after visual review.

PDF pages are rendered sequentially into previews with at most 700 pixels per side and 490,000 pixels per page. The current canvas is released and PDF page/document caches cleaned between pages. Only compact measurements are retained. There is one active scan-analysis request per local server; the existing 10-file, 20 MiB original-file, 35 MiB total/converted-total, 50-page-per-PDF and 50-million-image-pixel limits remain. Original and corrected comparison canvases use the existing separately bounded source renderer, not accumulated diagnostic page images.

Brightness, contrast, a Laplacian sharpness indicator and dark content near the edges produce heuristic hints. Predominantly white vector/text PDFs do not receive photographic overexposure/blur warnings merely because their background is white. A dominant embedded image can provide an estimated effective DPI from image dimensions and placement; unmeasurable resolution remains unknown. The estimate is not proof that small letters are readable.

A rotation suggestion requires sufficiently consistent visible PDF text baselines. It remains a proposal until explicitly selected and applied. Image-only page orientation remains unknown; EXIF orientation of ordinary images is respected by the existing preparation/correction path. No orientation classifier or handwriting-recognition promise is added.

The local API streams file/page progress as bounded NDJSON events. Aborting closes the request, destroys the active PDF task and prevents subsequent pages from being analyzed. Native source conversion already underway may finish before the cancellation check discards its output. Failed pages, an incomplete stream and cancellation remain explicit; an unfinished analysis cannot be reported as a completed clean check. The ordinary JSON response remains available to existing callers and also processes files sequentially.

## Corrections and source identity

Rotation and crop are explicit working-copy operations. New PDF corrections use a `rotations` map indexed by working page; existing whole-file `rotation` values remain supported as a fallback. A per-page entry overrides that fallback. Crop removal deletes the saved page crop. Reset removes all staged corrections for the selected file. It does not replace or mutate the original upload.

The existing page-order control now has an explicit reorder/apply workflow, preserving every original page exactly once. Crop/rotation entries move with their original page. The original preview displays the original page corresponding to the current working ordinal. Source geometry inverts the matching page rotation, expands the crop and restores the original page index. Batch range extraction remaps rotations alongside crops and page order. Studio drafts retain the optional maps through encrypted persistence/restart.

Original and working copy are shown side by side on larger screens and sequentially on small screens. A user can remove all corrections and return to the original. These operations cannot recover missing image areas or invent unreadable text; a crop must be checked to retain every relevant element.
