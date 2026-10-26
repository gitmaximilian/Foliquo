<p align="center">
  <a href="https://maximilianauer.at/projects/foliquo/demo/?lang=en">
    <img src="docs/images/cover.png" alt="Foliquo — From document to editable translation. Images, PDF and Word in one local browser workspace." width="100%">
  </a>
</p>

<p align="center">
  <strong>From document to editable translation.</strong><br>
  Foliquo Community is the free local browser-based workspace for noncommercial use covered by its license.<br>
  Runs on your computer. Opens in your browser. Foliquo Pro is a future commercial SaaS edition and is not available yet.
</p>

<p align="center">
  <a href="https://maximilianauer.at/projects/foliquo/demo/?lang=en"><strong>Try the demo</strong></a> ·
  <a href="https://github.com/gitmaximilian/Foliquo/releases"><strong>Downloads</strong></a> ·
  <a href="docs/BROWSER-SETUP.md">Setup guide</a> ·
  <a href="https://maximilianauer.at/projects/foliquo/">Project story</a>
</p>

<p align="center">
  <a href="https://github.com/gitmaximilian/Foliquo/actions/workflows/ci.yml"><img src="https://github.com/gitmaximilian/Foliquo/actions/workflows/ci.yml/badge.svg" alt="Tests"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-27272a" alt="PolyForm Noncommercial 1.0.0 license"></a>
  <img src="https://img.shields.io/badge/interface-EN%20%2F%20DE%20%2F%20AR-27272a" alt="English, German and Arabic interface">
</p>

## See the workflow

[![Actual Foliquo guided demo with a fictional document](docs/images/demo-workflow.png)](https://maximilianauer.at/projects/foliquo/demo/?lang=en)

**Upload → clarify → refine → download.** Combine the front and back of a document, confirm an uncertain reading, then export PDF and editable Word. Optional review tools stay out of the way until you need them.

The [interactive demo](https://maximilianauer.at/projects/foliquo/demo/?lang=en) walks through all four steps with a fictional driving licence. No account, installation or model request is needed. It includes downloadable PDF and Word examples, and supports English, German and Arabic.

## Made for document work

| One coherent workflow | What it does |
| --- | --- |
| **Add every page** | Images, PDFs and Word files can be grouped into one job. Source language and document type are detected automatically. |
| **Resolve uncertainty** | Accept a suggested spelling, answer a question, or explicitly mark a field unreadable. View the highlighted original with zoom and pan. |
| **Keep moving** | A job queue shows progress and requests for answers. Partial answers and revisions stay saved locally. |
| **Make it your own** | Upload finished translation examples to reuse layout and wording conventions. This supplies reference rules; it does not train model weights. |
| **Refine the result** | Compare original and translation, make direct edits or request changes in a revision chat. Download PDF and Word directly. |
| **Choose your provider** | ChatGPT account authorization, or separately billed OpenAI, Claude and DeepSeek APIs. Connect during onboarding or from the header. |

<details>
<summary><strong>A closer look at source review</strong></summary>

![Foliquo workspace showing the original document and translation controls](docs/images/source-zoom.png)

Wheel or trackpad zoom, drag-to-pan, fit-to-view, keyboard controls and a larger view keep small print accessible. The highlight scales with the image, and the view survives unchanged job polling.

</details>

## Download and start

Foliquo opens a local browser-based workspace. It listens only on `127.0.0.1`; keep its console open while working.

**Distribution status:** [Version 0.11.1](https://github.com/gitmaximilian/Foliquo/releases/tag/v0.11.1) is published with verified platform downloads and checksums. The [official Homebrew tap](https://github.com/gitmaximilian/homebrew-tap) is available. Foliquo is not yet available through WinGet.

| Platform | Installation and use |
| --- | --- |
| **macOS 15+, Apple Silicon / Intel** | Install with `brew install gitmaximilian/tap/foliquo`; start with `foliquo`, update with `brew upgrade foliquo`. Install LibreOffice Writer separately with `brew install --cask libreoffice`. |
| **Windows 10/11 x64** | Download the [Windows installer](https://github.com/gitmaximilian/Foliquo/releases/download/v0.11.1/Foliquo-Community-0.11.1-Windows-x64-Setup.exe). Node.js is bundled; install LibreOffice Writer separately. Start from the Start menu. Run the newer installer to update; uninstall from Installed apps. Foliquo is **not yet available through WinGet**. |
| **Linux x64, glibc** | Install Node.js 22+ and LibreOffice Writer. Verify and extract the [Linux archive](https://github.com/gitmaximilian/Foliquo/releases/download/v0.11.1/Foliquo-Community-0.11.1-Linux-x64.tar.gz), then run `./install.sh`. Start with `~/.local/bin/foliquo`. Stop it and run the newer archive's installer to update. |

Run `foliquo doctor` to verify PDF/Word export, `foliquo stop` to stop the service and `foliquo data-dir` to locate your private workspace. On Windows, use the installed `Foliquo.exe` for these commands. Browser startup never downloads application code.

### Data, updates and uninstall

Private data is stored separately: `~/Library/Application Support/Foliquo` on macOS, `%LOCALAPPDATA%\Foliquo` on Windows, and `$XDG_DATA_HOME/foliquo` (normally `~/.local/share/foliquo`) on Linux. Upgrades and uninstallers preserve it. Legacy `.local` folders are retained as recovery copies; follow the [verified migration instructions](docs/BROWSER-SETUP.md#private-data-and-migration) before removing an old installation.

The in-app update check links to the release page and sends no documents, settings or credentials to GitHub. Use your platform's update method. For uninstall, use `brew uninstall foliquo`, Windows Installed apps, or remove Linux's application directory and CLI symlink as described in the [setup guide](docs/BROWSER-SETUP.md).

## Local workspace, clear boundaries

Jobs, preferences and provider credentials are stored in the encrypted local workspace. The service binds to `127.0.0.1`. When you request translation or another model-assisted action, your selected provider receives the required document content. Provider usage and subscription limits still apply.

**Foliquo prepares drafts.** A qualified translator must review and certify a document where certification is required. AI can misread or omit information; the public demo illustrates the workflow, not translation accuracy. See [features and limitations](FEATURES.md) and [security notes](SECURITY.md).

## Requirements

- Windows 10 1809+/11 x64, macOS 15+ (packaged builds), or Linux x64 with glibc 2.35+.
- Node.js 22+ (24 LTS recommended) and LibreOffice Writer. macOS and Windows packages bundle the official pinned Node.js 24 runtime. Linux and source users install prerequisites separately.
- A modern browser. Keep the launcher terminal open while using the site.

## Developer checks

```sh
npm ci --ignore-scripts
npm test
npm run benchmark
npm run acceptance
npm run demo:build
```

See the [browser setup guide](docs/BROWSER-SETUP.md), [Features and limitations](FEATURES.md), [security notes](SECURITY.md), and [contributing](CONTRIBUTING.md).
