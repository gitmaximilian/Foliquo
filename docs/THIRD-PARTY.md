# Third-party software

Foliquo Community is distributed under PolyForm Noncommercial 1.0.0 (see LICENSE). This is a source-available license with restrictions on commercial use, not an OSI-approved open-source license. Individual dependencies retain their own licenses.

Production npm dependencies are locked in package-lock.json. Their license texts and copyright notices are retained in node_modules, including sharp/libvips, pdfjs-dist, pdf-lib, fontkit, jose, fflate, bmp-js and heic-convert. PDF.js assets in dist/vendor/pdfjs include LICENSE.txt and the standard font license notices. Noto Serif uses the SIL Open Font License; see the installed font package. Manrope font and brand notices are retained with their distributed assets. Inspect the exact packaged tree before every release.

The established macOS and Windows CLI packages include an unmodified official Node.js runtime with its complete LICENSE in runtime/LICENSE. The established Linux CLI package uses a separately maintained Node.js installation. LibreOffice is a separately installed prerequisite for those packages.

Tauri desktop packages bundle the official Node runtime on all three platforms and a copy of LibreOffice Writer. The LibreOffice application and its own license and notice files remain under `office/`; see https://www.libreoffice.org/about-us/licenses/ and https://www.libreoffice.org/download/ for upstream license and source information. The desktop shell uses Tauri 2 and native platform WebViews; Tauri and its Rust dependencies retain their licenses in the locked Cargo dependency graph. No Chromium or Electron runtime is bundled.

Translation DOCX files declare Aptos (Text Body), 11 pt, and do not bundle Microsoft fonts. PDF export embeds an installed Aptos font when available; if Aptos is unavailable, it uses the bundled SIL Open Font License Liberation Sans face so the document stays portable. PDF files rendered through LibreOffice follow the host's available font substitution.

Inno Setup builds the Windows installer. Its license permits distribution of compiled installers; see https://jrsoftware.org/files/is/license.txt. No Electron or desktop browser engine is bundled.
