# Third-party software

Foliquo Community is distributed under PolyForm Noncommercial 1.0.0 (see LICENSE). This is a source-available license with restrictions on commercial use, not an OSI-approved open-source license. Individual dependencies retain their own licenses.

Production npm dependencies are locked in package-lock.json. Their license texts and copyright notices are retained in node_modules, including sharp/libvips, pdfjs-dist, pdf-lib, fontkit, jose, fflate, bmp-js and heic-convert. PDF.js assets in dist/vendor/pdfjs include LICENSE.txt and the standard font license notices. Noto Serif uses the SIL Open Font License; see the installed font package. Manrope font and brand notices are retained with their distributed assets. Inspect the exact packaged tree before every release.

macOS and Windows packages include an unmodified official Node.js runtime with its complete LICENSE in runtime/LICENSE. Linux uses a separately maintained Node.js installation. LibreOffice is a separately installed prerequisite under its own licenses; it is not bundled or relicensed by Foliquo.

Inno Setup builds the Windows installer. Its license permits distribution of compiled installers; see https://jrsoftware.org/files/is/license.txt. No Electron or desktop browser engine is bundled.
