# Start Foliquo in your browser

1. [Download the project ZIP](https://github.com/gitmaximilian/Foliquo/archive/refs/heads/main.zip) and extract it to a folder you want to keep.
2. Open the matching setup file below. Follow any system installation prompts.
3. Setup checks PDF and Word export, then opens Foliquo in your default browser.
4. Keep the launcher window open while using Foliquo. Close it to stop the local service.

| Computer | First use | Later use |
| --- | --- | --- |
| Windows | `Setup-Foliquo.cmd` | `Start-Foliquo.cmd` |
| macOS | `Setup-Foliquo.command` | `Start-Foliquo.command` |
| Linux | `Setup-Foliquo.sh` | `Start-Foliquo.sh` |

You do not need to type commands. On Linux, use **Run as a Program** if double-clicking opens the file as text. On macOS, the setup file opens in Terminal.

Setup prepares Node.js, LibreOffice, and project dependencies through an available system package manager. If automatic installation is unavailable, it opens the official download page and explains which tool to install. Install that tool, then open setup again.

Foliquo runs at `http://127.0.0.1:4318/` on your own computer. The browser provides the entire interface. After starting the local service, opening the start file again reopens the browser.

## Updates

Choose **Guide & updates** in Foliquo. When an update is available, **Download update** downloads its source ZIP. Close the Foliquo launcher window, replace the program files with the extracted files, and open setup again. Keep the hidden `.local` folder: it contains your private workspace and credentials.

The release download contains source files and browser launch scripts. No Foliquo desktop installer is needed. Update checks send no documents, settings, or credentials to GitHub.
