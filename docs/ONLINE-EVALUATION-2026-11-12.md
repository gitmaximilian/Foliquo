# Online offering evaluation (maximilianauer.at)

Date: 2026-11-12 · Branch: `claude/intelligent-clarke-yzrtfa` · Scope: analysis only (no change to `main`, no deployment, no live provider calls, no real documents, nothing that costs money).

> **Status of the goal.** Sections 1, 2 (except the measured WASM export comparison), 3, 4, 5 and 6 are complete. **The measured export comparison for variant B is NOT done.** I downloaded the public LibreOffice-WASM npm packages (inspected statically, sizes below) but the sandbox permission classifier refused to *execute* the third-party package, and `zetaoffice.net`, `cdn.zetaoffice.net` and `github.com` are blocked by the session proxy. Only the native baseline (the reference side of the comparison) was measured. Section 2.4 gives the exact procedure to finish it once execution is approved. The recommendation in section 6 is therefore conditional on that gate.
>
> **Version note.** The repository at `main` (`aeb7a30`) and `package.json` say **0.15.0**, not 0.16.0. This document describes the code that is in the repository.
>
> **Labels.** **[V]** verified (code read, command run, or primary source read this session). **[S]** secondary source only (blog, forum, search summary). **[A]** assumption or estimate. **[L]** legal assessment, not legal advice; a lawyer is needed before relying on it (see 3.7).

## 0. Executive summary

1. **Everything except the PDF/Word-to-PDF conversion is plain JavaScript or WebAssembly-capable already**: OCR already runs in the browser (`dist/source-text.js:3` loads `/vendor/tesseract/…`) [V]; the `.docx` export is pure JS (`lib/word.mjs`, `fflate`, no LibreOffice) [V]. LibreOffice is only needed for (a) converting uploaded `.doc/.docx/.odt/.rtf/.txt/.md` to PDF (`lib/formats.mjs:59`), (b) the styled PDF export and the Arabic-target PDF (`lib/documents.mjs:148-163`), and (c) the one-page layout fitting test (`lib/documents.mjs:31`) [V].
2. **Exact same functions are only achievable with variant A** (hosted Node + LibreOffice). Even there, ChatGPT-account sign-in, the local data directory and OS integration cannot be 1:1 (2.2).
3. **Variant A is the worst fit for a private individual**: you would store identity documents (GDPR Art. 9 data likely) for strangers, run LibreOffice on hostile uploads, and carry controller/processor duties, breach notification and a DPIA question [L]. Operations estimate 8–20 h/month [A].
4. **Variant B (browser only) removes your data-protection role for documents almost entirely [L]**, but (i) LibreOffice-WASM is 77 MB compressed / ~247 MB raw, needs cross-origin isolation, and exceeds Cloudflare Pages' 25 MiB per-file limit [V/S]; (ii) OpenAI API calls from a browser are reported to be blocked by CORS [S], ChatGPT-account sign-in cannot work from a web origin [A]; (iii) export parity was **not yet measured**; (iv) PolyForm Noncommercial conflicts with professional users running a *shipped copy* in their browsers [L].
5. **Even the native desktop export is not font-stable**: on this machine the DOCX path embedded *Inter* (Aptos missing) and the Arabic HTML path embedded *FreeSerif* [V]. "Identical to desktop" is only definable against a pinned font set; the WASM build ships its own fonts, so it can be deterministic but will not match every desktop.
6. **Recommendation (section 6):** do not build A. Make **B the target, C the fallback**, and gate the whole effort on two cheap prototypes: the WASM export comparison and a BYOK provider-call test. Keep desktop/browser/CLI and the `127.0.0.1` binding unchanged in all cases.

## 1. Function inventory

Evidence: `server.mjs` (routes), `lib/*.mjs`, `dist/*.js`, `desktop/src-tauri`, `FEATURES.md`, `docs/*.md`. "Where" = where it runs today. "Online needs" = what a web offering must provide.

| # | Function | Where it runs today | Online needs |
|---|---|---|---|
| 1 | Upload PDF, JPG, PNG, WebP, GIF | Browser reads file → base64 → local Node (`/api/translate`, `validateUpload` `lib/formats.mjs`) | Same validation in browser (A: server) |
| 2 | Upload TIFF, BMP, HEIC/HEIF, AVIF → PDF | Node: `sharp`, `heic-convert`, `bmp-js`, `pdf-lib` (`lib/formats.mjs:75-90`) | A: as is. B: needs WASM image codecs (sharp is native) |
| 3 | Upload DOCX/DOC/ODT/RTF/TXT/MD → PDF | Node spawns native `soffice --convert-to pdf` (`lib/formats.mjs:59`) | LibreOffice (server or WASM) |
| 4 | Size/format limits (20 MB/file, 35 MB total, 50 pages) | Node (`validateUpload`, `prepareDocuments`) | Re-implement client side |
| 5 | OCR / source text and geometry for review | **Browser**: tesseract.js WASM (`dist/source-text.js:3`, assets 35 MB in `dist/vendor/tesseract`); PDF text via pdf.js (5.7 MB) | Static assets only |
| 6 | OCR of scanned style examples | Node tesseract.js (`lib/learning-analysis.mjs:4,86`) | Move to browser worker (B) |
| 7 | Translation via provider (OpenAI API, Claude, DeepSeek) | Node `fetch` to provider with key from workspace (`lib/providers.mjs`) | Browser direct (CORS) or proxy; key handling |
| 8 | ChatGPT-account sign-in | Node OAuth with loopback callback `/auth/callback` (`lib/chatgpt.mjs:21-31`, `server.mjs:455`) | Not portable (redirect to loopback, dynamic agent client) [A] |
| 9 | DeepSeek PDF → page images | Node pdf.js + `@napi-rs/canvas` (`lib/providers.mjs` `pdfAsImages`) | Browser canvas (easy) |
| 10 | Clarification questions, unreadable marker, drafts | Node queue + workspace (`/api/jobs/:id/answer`, `/unreadable`, `/clarification-draft`) | State store |
| 11 | Review/verify, revision, side-by-side editor, locate, refine | Node routes + browser UI (`dist/review.js`, `document-editor.js`, `/api/jobs/:id/verify|revision|refine|locate`) | Provider calls + state |
| 12 | Certified-translation human-review boundary | Policy in code (`lib/translation-policy.mjs`, `certificationConfirmed`) | Must be preserved verbatim |
| 13 | PDF export, plain Latin target | Node `pdf-lib` + embedded fonts, **no LibreOffice** (`lib/documents.mjs` `createTranslationPDF`) [V] | pdf-lib runs in browsers |
| 14 | PDF export, styled/layout/Arabic→German | DOCX built in JS, then LibreOffice → PDF, then pdf-lib appends originals (`createStyledPDF`) | LibreOffice |
| 15 | PDF export, Arabic target | HTML → LibreOffice → PDF (`createArabicPDF`) | LibreOffice with Arabic shaping |
| 16 | Word (.docx) export | Pure JS (`lib/word.mjs`, `fflate`) [V]; layout fitting calls LibreOffice (`fitTranslationLayout`) | Only fitting needs LibreOffice |
| 17 | Library by document type | Node workspace (`workspace.library()`) | State store |
| 18 | Content search | Node (`lib/search-index.mjs`, `search-chunks.mjs`, `/api/search/*`) | Port index to browser |
| 19 | Dossiers (entities, facts) | `lib/dossier-api.mjs`, `lib/dossiers.mjs` | State store |
| 20 | Foli chat assistant | `lib/foli-api.mjs`, `foli-chat.mjs`, provider calls | Provider calls |
| 21 | Learn style / examples / rules | `lib/learning*.mjs`, `personal-rules.mjs`, `rule-*.mjs` | State store + OCR (6) |
| 22 | Glossary incl. CSV import/export | `lib/glossary*.mjs`, `/api/library/glossary/*` | State store |
| 23 | Budget / usage accounting | `lib/usage.mjs`, `/api/usage`, `/api/settings` | State store |
| 24 | Retention/auto-delete, queue pause/resume | `lib/queue.mjs`, `settings.retentionDays` | Timers while tab open only (B) |
| 25 | Workspace encryption | AES-256-GCM per object (`lib/secure-store.mjs`); key file `workspace.key` **next to the data** (`lib/workspace.mjs:99`, `data-directory.mjs:25`) [V] | WebCrypto (B) or server KMS (A) |
| 26 | Backup / restore / migration | scrypt + AES-GCM stream, `/api/backup`, `/api/backup/restore` (`workspace.mjs:220-306`) | Download/upload file; works in browser if scrypt available (WASM) |
| 27 | Updates | Read-only GitHub release check (`server.mjs:474`) + Tauri updater on Win/macOS | Replaced by deployment; no user action |
| 28 | Languages EN/DE/AR | `dist/i18n.js`, `runtime-i18n.js` (browser) | Static |
| 29 | Demo, onboarding tour, diagnostics, connection check | Browser + `/api/demo`, `/api/diagnostics/check` | Static / provider calls |
| 30 | Desktop window, loopback binding, CSRF/origin checks | Tauri 2 shell, Node on `127.0.0.1` (`server.mjs:443,468`) | Not applicable online; must stay unchanged |

Where-it-runs summary: browser = UI, i18n, OCR, pdf.js preview; local Node = everything stateful (queue, workspace, search, rules, provider calls, exports); LibreOffice = items 3, 14, 15, 16 (fitting); filesystem = workspace, backups; OS = data directory, keychain-less key file, desktop shell, updater [V].

## 2. Architecture variants

Legend: ✔ 1:1 · ◐ restricted (how) · ✖ not possible.

### 2.1 Variants

- **A. Classic server:** the existing Node service plus LibreOffice on a hosted VM/container, with accounts and per-tenant storage.
- **B. Browser only:** static files; state in IndexedDB/OPFS encrypted with WebCrypto; OCR in browser (already so); LibreOffice-WASM (+ pdf-lib/pdf.js in browser); provider calls directly from the browser.
- **C. Hybrid:** B, but conversions that need LibreOffice go to a stateless export endpoint (document in, PDF out, nothing stored, no logs of content).

### 2.2 Per-function feasibility

| # | Function | A | B | C |
|---|---|---|---|---|
| 1 | Upload common formats | ✔ | ✔ | ✔ |
| 2 | TIFF/BMP/HEIC/AVIF | ✔ | ◐ needs WASM codecs; HEIC and TIFF decoders must be added and re-tested | ◐ same, or send to endpoint |
| 3 | DOC/DOCX/ODT/RTF/TXT → PDF | ✔ | ◐ WASM, unmeasured parity | ✔ (same LibreOffice binary as A) |
| 4 | Limits | ✔ | ◐ browser memory is the limit; 35 MB inputs plus a ~250 MB WASM image may exceed phone limits [A] | ◐ |
| 5 | OCR (review) | ✔ | ✔ already browser-based | ✔ |
| 6 | OCR style examples | ✔ | ✔ (move to worker) | ✔ |
| 7 | Translation, own keys | ✔ server calls providers | ◐ Anthropic direct with `anthropic-dangerous-direct-browser-access` [S]; OpenAI API CORS reported blocked [S]; DeepSeek CORS unverified [S]; otherwise needs a proxy, which sees documents | ◐ same as B; a proxy would be a second stateless service |
| 8 | ChatGPT sign-in | ✖ (loopback/dynamic-client flow, cannot be assumed to accept your domain) [A] | ✖ | ✖ |
| 9 | DeepSeek page images | ✔ | ✔ canvas | ✔ |
| 10-12 | Questions, review, editor, boundary | ✔ | ✔ (UI exists; routes become local calls: large port) | ✔ |
| 13 | PDF plain | ✔ | ✔ pdf-lib | ✔ |
| 14-15 | PDF styled / Arabic | ✔ same engine as desktop (fonts must be pinned) | ◐ WASM fonts differ from host fonts [V that host fonts matter] | ✔ with pinned fonts |
| 16 | Word export | ✔ | ✔ (fitting step needs WASM) | ✔ |
| 17-23 | Library, search, dossiers, Foli, learning, glossary, budget | ✔ | ◐ port from Node modules to browser storage; data lives on one device/browser profile | ◐ same as B |
| 24 | Retention timers, queue | ✔ | ◐ only runs while the tab is open; long jobs die with the tab | ◐ |
| 25 | Workspace encryption | ◐ server-side keys: operator can read data (not equal to local-only) | ◐ WebCrypto; key must come from a user passphrase, not a file next to the data; XSS can reach keys in memory | ◐ same as B |
| 26 | Backup/migration | ✔ (but cross-device import of desktop backups needs format compatibility test) | ◐ file download/upload; Safari storage eviction makes backup mandatory | ◐ |
| 27 | Updates | ✔ deploy | ✔ deploy; service-worker cache must be versioned | ✔ |
| 28 | EN/DE/AR | ✔ | ✔ | ✔ |
| 30 | Loopback/desktop | unchanged (separate product) | unchanged | unchanged |

Count (items 1-29, grouped): **A**: all ✔ except ChatGPT sign-in ✖ and encryption ◐. **B**: ✖ ChatGPT sign-in; ◐ providers, images, LibreOffice parity, storage durability, encryption model; rest ✔ after a large port. **C**: as B, with LibreOffice parity ✔ but the "no document reaches my servers" promise gone.

### 2.3 Facts behind the ratings

- Browser storage: Safari's ITP may cap script-writable storage (IndexedDB, localStorage) after 7 days without interaction [S: [Didomi](https://docs.didomi.io/releases-and-announcements/announcements/apple-implements-7-day-cap-on-script-writable-storage), [WebKit bug 237350](https://bugs.webkit.org/show_bug.cgi?id=237350)]. Persistence grants and OPFS behaviour were not verified [A].
- Anthropic: browser calls require the opt-in header [S: [Simon Willison](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access)]. OpenAI: browser requests reported blocked by CORS [S: [OpenAI forum](https://community.openai.com/t/has-the-cors-policy-changed-responses-api/1372791)]. DeepSeek: only an unverified claim of `*` [S]. **No live provider call was made** (task constraint), so none of this is verified.
- Keys in browsers are visible to any script on the origin; a successful XSS exfiltrates them.

### 2.4 LibreOffice-WASM: what was verified, what was not

Verified by static inspection (npm tarballs, not executed):

| Item | Value |
|---|---|
| Package | `@bentopdf/libreoffice-wasm@2.3.1` and `@matbee/libreoffice-converter@2.7.2` (both MPL-2.0, same `soffice.wasm`/`soffice.data` sizes) [V] |
| `soffice.wasm` | 147,411,502 B raw, 48,763,638 B gzip [V] |
| `soffice.data` (fonts, config) | 99,735,918 B raw, 28,604,373 B gzip [V] |
| Total download | ~77.4 MB gzip, ~247 MB raw (README: "~240MB initial download") [V] |
| Threads | Emscripten pthreads, `SharedArrayBuffer` → needs `COOP: same-origin` + `COEP: require-corp` (package README) [V] |
| Cloudflare Pages/Workers static asset limit | 25 MiB per file → the 48 MB wasm needs splitting, R2 or a VPS [S: [Cloudflare docs](https://developers.cloudflare.com/pages/platform/limits)] |
| LibreOffice version inside the WASM build | not determined (native reference here is 24.2.7.2) [A: differs] |

Native reference, measured here (`scripts/online-eval/native-baseline.mjs`, 4 vCPU, 16 GB, LibreOffice 24.2.7.2, 7 fictional fixtures from `scripts/office-slim.mjs`) [V]:

| Fixture | ms (cold `soffice` per file) | Pages |
|---|---|---|
| german.docx | 1146 | 1 |
| english.docx | 974 | 1 |
| arabic.html | 1090 | 1 |
| note.txt | 936 | 1 |
| german.odt / .rtf / .doc | 1237 / 1126 / 1149 | 1 each |

Two runs produced identical PDF page-content signatures (`deterministic: true`, same method as `scripts/office-slim.mjs` `pdfSignature`). Fonts embedded on this host: DOCX path `Inter-Regular/Bold` (Aptos not installed, `fc-match Aptos` → Inter), Arabic HTML path `FreeSerif` [V]. `docs/THIRD-PARTY.md` already states PDF rendering follows host font substitution [V].

**Not measured (blocked):** WASM output signatures vs native, WASM cold-start and per-file times on laptop and phone, peak memory. Because the WASM bundles its own fonts, I expect different font embedding and therefore **different page-content hashes** even for identical layout [A]. The acceptance test should therefore be two-tier: (1) strict: same signature as native using the same pinned fonts loaded into both; (2) functional: same page count, page size, extracted text and RTL order, and visual diff under a tolerance.

Procedure to finish (needs permission to run the downloaded package, ideally in a throw-away sandbox):

1. Extract tarball into an empty directory; `npm install zod jszip --ignore-scripts` there.
2. Run `convert(docx,{outputFormat:'pdf'})` for the same 7 fixtures plus a multi-page table document and an Arabic-target DOCX, in Node and in Chromium (Playwright with COOP/COEP headers), recording init time, per-file time, peak RSS.
3. Compare with `pdfSignature` (2 tiers above), `pdffonts`, `pdftotext`, and a rasterised diff.
4. Repeat inside Chromium with CPU throttling 4× and a mobile profile to approximate a phone [A: throttling is only an approximation].
5. Repeat after injecting the same Liberation/Noto fonts into both engines.

## 3. Law and data protection (Austria/EU, you as an individual operator)

**[L] throughout. This is an engineering-side orientation, not legal advice. A lawyer (preferably Austrian IT/data protection) must review before launch (3.7).**

### 3.1 Role under the GDPR per variant

| | Role of the operator | Why |
|---|---|---|
| A | Probably **processor** for business users (translators, offices) who decide purpose and means (Art. 28), and arguably **controller** for private consumers outside the household exemption question; the mix is itself a legal question | You store and process the documents on your infrastructure. EDPB Guidelines 07/2020: a service provider is not automatically a processor; the role follows who decides purposes and essential means [S: [EDPB consultation page](https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2020/guidelines-072020-concepts-controller-and_mt?page=9)] |
| B | **Controller only for website operation data** (hoster logs incl. IP addresses, any analytics). No role for document content, as nothing reaches you | Processing happens on the user's device; you provide software. Arguments are strong but depend on facts (no telemetry, no error reports with content, no proxy) |
| C | **Processor** for the transient content (and possibly nothing stored) | Receiving and converting content is processing even if it is not retained |

### 3.2 Duties by variant

| Duty | A | B | C |
|---|---|---|---|
| Privacy notice (Art. 13/14) | Full, incl. document processing | Short, website only | Full for export endpoint |
| Records of processing (Art. 30) | Required; the small-enterprise exemption does **not** apply where special categories are processed (Art. 30(5)) [S: summary of the GDPR text] | For website logs only (likely light) | Required for the endpoint |
| Contracts (Art. 28) with hosters/sub-processors, and with your own customers as their processor | Yes: hoster, backup storage, e-mail; DPA for users | Only your static host (DPA usually click-through) | Hoster of the export service |
| TOMs (Art. 32): encryption, access control, isolation, logging, backups | Heavy | Minimal (supply-chain and header hygiene) | Moderate |
| Deletion concept (Art. 17, retention) | Required: per-tenant erase, backup expiry | Not for documents; user clears browser data | Document that nothing is stored |
| Data subject rights | Must be answerable for stored documents (the persons named in the documents are data subjects who never contacted you) | Website only | Practically none if nothing is stored |
| Breach notification (Art. 33: without undue delay, if feasible within 72 h; processors notify the controller) [S] | Realistic risk | Low | Low |
| DPIA (Art. 35) | Likely to be needed or at least documented: identity/civil-status documents contain special-category data (religion, health, origin) and legal-status data; check the Austrian DSB "no DPIA" list [S] | No | Consider |
| Third countries | Hoster, AI provider | AI provider (user's choice), CDN | Hoster |

### 3.3 Art. 9 special categories in certificates

Birth, marriage, medical, court and school documents routinely reveal origin, religion, health or family status. In A you would hold them at rest for third parties, which raises the required security level and the DPIA question. In B they never reach you; the user alone chooses whether to send them to an AI provider, with their own key and contract [L].

### 3.4 What changes if no document reaches your servers (B)

The substantial burdens (processor contracts with users, TOM catalogue, deletion, breach duty, DPIA) disappear. Remaining: privacy notice for the website, hoster DPA, honest "no content leaves your device except to the provider you select" wording, and keeping that statement true: no error reporting with content, no analytics on documents, no proxy. The user's provider relationship (OpenAI/Anthropic/DeepSeek terms) should be shown at the moment of connection. If you add a proxy for OpenAI, you are back to C-type processing [L].

### 3.5 Imprint, liability, terms

- **Impressum/Offenlegung:** ECG § 5 (contact data, address for service, e-mail) and MedienG § 25 (disclosure; reduced duties for small sites; administrative fine up to € 20,000 reported) [S: [WKO guidance](https://www.wko.at/oe/internetrecht/das-korrekte-website-impressum-eu.pdf), [USP](https://www.usp.gv.at/themen/brancheninformationen/information-und-kommunikation/offenlegungspflicht-gemaess-para-25-mediengesetz.html), [ECG § 5](https://gesetzefinden.at/bundesrecht/bundesgesetze/ecg/para-5)]. Whether a free hobby service counts as a commercial information-society service is unclear to me [A]; provide a full Impressum anyway.
- **Liability and terms:** the product already says it is not a certified translation (`FEATURES.md`). An online offer needs written terms (disclaimer of reliance, no legal advice, availability, AI-provider responsibility, user's duty to check each page). Consumer law (KSchG/ABGB) limits what can be excluded [L].
- **Third-country transfers:** US-based hosters and the AI providers fall under Chapter V (adequacy/DPF or SCCs). For B you transfer nothing yourself except IP addresses to the hoster/CDN [L].

### 3.6 Licences

- **Foliquo = PolyForm Noncommercial 1.0.0** (`LICENSE`) [V]. Text: "Any noncommercial purpose is a permitted purpose"; personal use and non-profit organisations are covered; Notices clause requires passing on the licence terms and `Required Notice:` lines to anyone who gets a copy [V, read from `LICENSE`].
  - You are the licensor, so the licence does not bind you for your own code (assuming no third-party contributions without assignment; check `CONTRIBUTING.md`) [L].
  - **A (hosted):** users receive no copy of the software, only a service. Free offering: unproblematic. Paid offering: your own right as licensor; no conflict from the licence itself [L].
  - **B/C (shipped to browsers):** a copy of the JS is distributed to each user. They get only noncommercial rights. **A professional translator using it for work would be outside the licence** unless you grant a separate commercial licence or change the licence for the web build. This is the most important licence finding [L].
  - Paid access also raises whether "noncommercial" still describes the product; ask a lawyer before charging [L].
- **LibreOffice:** MPL 2.0 (package metadata) [V]. File-level copyleft; if you distribute the WASM build you must make the corresponding source available and ship notices; unmodified upstream code is the simplest case. Also contains other licences (fonts, libraries) listed in the build [A: review needed]. Hosting it server-side (A) is not distribution.
- **Tesseract:** Apache 2.0 [S]; language data from `@tesseract.js-data/*` (see `docs/THIRD-PARTY.md`); notices already shipped in `dist/vendor/tesseract`.
- **Fonts:** Liberation Sans (SIL OFL) is already bundled; Noto Serif (OFL). **Aptos is proprietary and cannot be served**; the app only references it by name (`docs/THIRD-PARTY.md`) [V].

### 3.7 Where a lawyer is needed

(1) controller/processor classification for A or C and the consumer/business mix; (2) whether a DPIA is required for A; (3) licence change or dual licence for B/C and for any charging; (4) terms of use and liability clauses; (5) Impressum scope; (6) AI-provider terms for sub-processing; (7) MPL source-offer wording for WASM redistribution.

## 4. Security and operations

### 4.1 Threats by variant

| Threat | A | B | C |
|---|---|---|---|
| Tenant isolation | Central risk: one bug exposes strangers' documents. Needs per-tenant keys, auth on every route (today there is **no auth**, only a loopback session + CSRF, `server.mjs:468-473`) | None (single-user browser profile) | None for storage |
| Malicious uploads | Server parses PDF/DOCX/HEIC/TIFF with LibreOffice, sharp, pdf.js: needs sandbox (container, seccomp, no network, CPU/RAM/time limits, per-job profile as today) | Contained in the user's browser sandbox | Endpoint exposed to hostile files; same sandbox needs as A, no data at rest |
| Account takeover | Passwords/MFA/reset/e-mail abuse: new attack surface and duties | No accounts | No accounts (abuse control: rate limit) |
| Key theft | Provider keys stored server-side: high-value target. Today they sit encrypted in the local workspace | Keys only in the user's browser; XSS or malicious extension can read them | Keys never reach endpoint |
| XSS with access to local data | Server data reachable if session stolen | **Highest risk**: XSS reads IndexedDB, decrypted state and keys. Needs strict CSP, no third-party scripts, SRI, no dynamic HTML, review of `innerHTML` in `dist/*.js` | Same as B |
| Backups | You back up customer data: more liability | User's responsibility; Safari eviction risk [S] | n/a |
| Updates | Patch LibreOffice, Node, OS monthly (security patch cadence) | Deploy static files; cache-bust; supply-chain pinning | Patch LibreOffice on the endpoint |
| DoS/cost abuse | CPU abuse of conversion | CDN absorbs | Conversion abuse: rate limiting/Turnstile-type challenge [A] |
| Supply chain | npm + OS | npm + 77 MB third-party WASM from a package whose build is not reproducibly verified by you [A] | Same as B plus server |

### 4.2 Monthly effort (estimates [A])

| | Hours/month | Basis |
|---|---|---|
| A | 8-20 | OS and LibreOffice patching, monitoring, backup tests, abuse handling, support, privacy requests; plus a one-off build of auth, tenancy, quotas (weeks, not hours) |
| B | 1-3 | Dependency updates, deploy, support; header/CSP checks |
| C | 3-6 | B plus patching/monitoring a stateless container |

## 5. Costs

Basis: operator pays only for hosting; AI usage is billed to each user's own key (BYOK) [V by design: `lib/providers.mjs`], so there is no inference cost for you. Prices are secondary sources and must be re-checked before decisions.

### 5.1 Free options and limits

| Service | Free allowance and limit | Fit |
|---|---|---|
| Cloudflare Pages/Workers static | 25 MiB per file; Workers free 100k requests/day, 10 ms CPU; free accounts 100 MB request body [S: [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits)] | B static front end: yes. WASM (48 MB file) needs splitting; COOP/COEP via `_headers` [A] |
| GitHub Pages | cannot set response headers → no COOP/COEP without a service-worker workaround; soft size/bandwidth limits; commercial use restricted by terms [A, unchecked] | Poor for LibreOffice-WASM |
| Oracle Cloud Always Free (Ampere A1) | reported cut from 4 OCPU/24 GB to 2 OCPU/12 GB from 15 Jun 2026; idle reclaim after low utilisation [S: [InfoQ](https://infoq.com/news/2026/07/oracle-cloud-free-tier-limits/)] | A/C at tiny scale; data location and reclaim risk make it unsuitable for personal documents |
| Fly.io / similar | free tier largely gone [S] | No |

### 5.2 Paid reference

Hetzner CX-class VPS (2 vCPU, 4 GB): about € 4.4-4.6/month ex VAT plus 20 TB traffic, with price increases reported for 2026 [S: [price roundup](https://vpsbenchmarks.com/hosters/hetzner/plans/cx22)]. Domain exists (maximilianauer.at). TLS free (Let's Encrypt/Cloudflare).

### 5.3 Estimated monthly cost by active users [A]

Assumptions: native LibreOffice conversion ≈ 1.0-1.2 s CPU [V]; about 4 conversions per finished job (upload, layout fitting up to 3 candidates, export) ≈ 5 s CPU; 20 jobs per user per month; stored data 100-500 MB per user in A.

| Active users | A (VM + storage + backups + monitoring) | B (static) | C (static + stateless export) |
|---|---|---|---|
| 10 | ~ € 6-10 (one small VPS, 100 jobs/month) | € 0 (free static tier if WASM fits limits; otherwise ~€ 4-5 VPS or object storage) | € 0-5 |
| 100 | ~ € 10-25 (2-4 vCPU, 50-100 GB, offsite backup) | € 0-5 (WASM traffic: 77 MB × first-time visitors, cached afterwards; 100 users ≈ 8 GB first load) | € 5-10 |
| 1000 | ~ € 60-200 (several vCPUs or autoscaled workers, 0.5 TB storage, backups, monitoring, DDoS/abuse tooling) plus real ops time | € 5-20 (WASM bandwidth ≈ 77 GB for first loads; free CDN egress covers it on Cloudflare, otherwise ~ € 1-5) | € 20-60 |

Hidden costs in A: legal drafting, incident readiness, your time (4.2). Cost is not the deciding factor; risk and time are.

## 6. Recommendation

### 6.1 Scorecard (1 = bad, 5 = good; function scope = share of desktop functions at 1:1)

| Criterion | A | B | C |
|---|---|---|---|
| Function scope | 4 (all but ChatGPT sign-in; local-only claims weakened) | 3 (provider CORS limits, image codecs, export parity unproven, storage durability) | 3.5 |
| Data-protection effort (higher = lighter) | 1 | 5 | 3 |
| Security (exposure of third parties' data) | 2 | 4 (XSS is the key risk) | 3.5 |
| Cost | 3 | 5 | 4 |
| Maintenance effort | 1 | 4 | 3 |
| User experience | 4 (fast, any device) | 2-3 (77 MB first load, memory on phones) | 3.5 |
| Licence fit (PolyForm NC) | 4 | 2 (copies shipped; professionals) | 2 |

### 6.2 Recommendation

1. **Do not build A.** It is the only way to get literal parity, but it makes a private individual the custodian of strangers' identity documents with processor/controller ambiguity, a DPIA question, tenant isolation, hostile-upload exposure and 8-20 h/month of operations. The product's own docs already require "authentication, TLS, tenant isolation, upload controls, and a separate security review" before any public hosting (`SECURITY.md`, `ONLINE-DELIVERY.md`) [V].
2. **Target B, fall back to C only for the export step.** B keeps the central privacy promise (documents never reach you) and nearly all functions. Accept two honest limits: no ChatGPT-account sign-in, and provider support is whatever the browser can call directly (Anthropic yes with opt-in header [S]; OpenAI API and DeepSeek need verification, else excluded or via a clearly disclosed proxy that turns the offering into C).
3. **Resolve the licence first.** Shipping to browsers distributes copies under PolyForm Noncommercial. Decide: free, noncommercial-only web build, or a separate commercial licence for the web build [L].
4. **Keep desktop, browser/CLI and the `127.0.0.1` binding untouched**; the online client would be a separate build target reusing `dist/` and pure-JS modules, not a change to the local service.

### 6.3 Stepwise plan (each step is a go/no-go gate)

| Step | What to prove | Cost/risk | Pass criterion |
|---|---|---|---|
| 0 | Lawyer consult on 3.7 items 3 and 1 | few hundred € [A] | Licence path chosen |
| 1 | **Finish the WASM export comparison** (2.4) on laptop and mid-range phone | € 0, local | Page count, size, text and RTL equal on all fixtures; visual diff small with pinned fonts; cold start < 20 s on laptop, < 60 s on phone [A thresholds]; peak memory below mobile limits |
| 2 | BYOK provider test from a browser with test keys you own (each provider; **needs your explicit approval**, small paid calls) | few cents | Streaming works from a static origin; key never sent elsewhere |
| 3 | Port-feasibility spike: run `lib` modules (search index, rules, glossary, workspace schema) over IndexedDB/OPFS with WebCrypto, passphrase-derived key (scrypt/Argon2 WASM) | days | Existing backup format round-trips |
| 4 | Security review of CSP/XSS surface in `dist/*.js` | days | No inline script, no unsafe HTML sinks |
| 5 | Static hosting trial on a free tier with COOP/COEP; split WASM under 25 MiB | € 0 | Works cross-browser incl. Safari |
| 6 | Only if gates 1-5 fail on export: add stateless C export container (no storage, no content logs, rate limit) | € 5-10/month + DPA | Processor documentation complete |

### 6.4 Risks

Export parity may fail the strict tier because of fonts (likely) and engine version differences; a 77 MB first download and ~250 MB memory footprint may exclude phones; Safari storage eviction can destroy the workspace without a backup; provider CORS can change at any time; a licence change may be needed; the unsafe-by-default XSS posture of a local-first web app means a single injection can leak all documents and keys.

### 6.5 Completion check against the goal

| Required | Status |
|---|---|
| Every function assigned to every variant | Done (1, 2.2) |
| Export comparison for B measured | **Not done**: native baseline measured; WASM run blocked by sandbox permission and network allowlist; procedure and expected issues documented |
| Legal and cost sections with sources | Done, mostly secondary sources; primary texts (PolyForm site, SPDX, EDPB final guideline) were unreachable here, the PolyForm text was read from `LICENSE` |
| Clear recommendation | Done (conditional on step 1) |

## Appendix: reproducibility

- Native baseline: `node scripts/online-eval/native-baseline.mjs` (requires `npm ci --ignore-scripts` and LibreOffice).
- WASM tarballs inspected: `npm pack @bentopdf/libreoffice-wasm`, `npm pack @matbee/libreoffice-converter` (unpack in an empty directory; do not execute scripts).
- Repository evidence lines refer to commit `aeb7a30`.
