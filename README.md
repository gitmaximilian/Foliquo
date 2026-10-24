# TranslateOCR

TranslateOCR is an open-source, browser-based workspace for preparing document-translation drafts. It runs as a private local service on your computer and opens in your existing browser. There are no Windows, macOS, or Linux app packages.

> Translation drafts are not certified translations. A qualified translator must review and certify the final document.

## Download and start

1. Download and extract the [latest source ZIP](https://github.com/gitmaximilian/TranslateOCR/archive/refs/heads/main.zip).
2. Open the extracted folder and double-click the setup file for your computer: `Setup-TranslateOCR.cmd` on Windows, `Setup-TranslateOCR.command` on macOS, or `Setup-TranslateOCR.sh` on Linux.
3. Follow any system permission prompt. Setup prepares the required tools, checks PDF and Word export, then opens TranslateOCR in your browser.
4. Leave the small TranslateOCR window open while using the site. Close it to stop TranslateOCR. Next time, double-click the matching `Start-TranslateOCR` file.

On macOS, the setup file opens in Terminal; it is a setup script, not a TranslateOCR app. On Linux, use the file manager's **Run** or **Run as a Program** action if a double-click opens the script as text.

Setup uses the system package manager when available to prepare Node.js and LibreOffice, then installs the project files and opens the site automatically. If a supported package manager is unavailable, setup opens the official download page and guides you through the missing prerequisite; install it and run setup again. You do not need to enter commands. The first setup may ask for your computer password or permission to install these tools.

The service is bound to your own computer (`127.0.0.1`); other people cannot access it over your network. Use the browser page while the service is running. The app does not install a browser extension or a standalone web app.

### Updates

TranslateOCR checks the public GitHub release list when you open **Guide**. If a newer release exists, choose **Download update**, close the TranslateOCR launcher window, extract the ZIP over the existing TranslateOCR folder, and run the setup file again. Keep the hidden `.local` folder in place: it contains your encrypted jobs, preferences, and provider credentials. The updater never sends document data to GitHub. If GitHub is temporarily unavailable, the app keeps working and you can check again later.

## What it does

- Accepts images, PDFs, and Word documents; several files can be combined into one job.
- Detects the source language and document type, then groups completed jobs automatically in the library.
- Supports ChatGPT sign-in and separately billed OpenAI, Claude, and DeepSeek API keys. AI setup is available in the first-run tour and from the header.
- Keeps jobs in a collapsible sidebar opened from the header, with a live progress indicator and color-coded status. Clarification drafts and added source images are saved in the encrypted local workspace; return to a job without losing partial answers.
- Accepts suggested readings with one click or marks a source field as unreadable; each confirmed question closes immediately.
- Creates PDF and editable Word drafts, supports clarifications, direct edits, a revision chat, and optional review tools.
- Learns reusable layout and wording conventions from samples you explicitly add. It does not train a model and must not reuse personal facts from samples.
- Includes an optional, fictional demo in English, German, and Arabic.

## Requirements

- Windows 10/11, a current macOS release, or a mainstream Linux distribution.
- Node.js 22 or newer and LibreOffice Writer. Setup installs them with `winget` on Windows or Homebrew on macOS where available. On Linux, use the package manager instructions shown by setup if either is missing.
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
