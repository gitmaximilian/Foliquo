# Windows quick start

1. Download and extract the latest TranslateOCR source ZIP from GitHub.
2. Double-click `Setup-TranslateOCR.cmd`. Approve the Windows package-manager prompts to install Node.js and LibreOffice if they are missing. Setup checks PDF and Word export, then opens TranslateOCR in your browser.
3. Keep the TranslateOCR window open while using the site. Close it when you want to stop TranslateOCR.
4. Next time, double-click `Start-TranslateOCR.cmd`.

TranslateOCR runs locally at `http://127.0.0.1:4318/`. The browser is the user interface; no desktop app is installed. If SmartScreen shows a prompt for the setup script, check that the ZIP came from the official TranslateOCR GitHub repository before continuing.

To update, open **Guide & updates** in TranslateOCR, choose **Download update**, extract the new source ZIP over the existing folder, and run `Setup-TranslateOCR.cmd` again. Keep `.local`; it contains the encrypted local workspace and credentials.
