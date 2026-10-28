# Install and use Foliquo Community

Foliquo runs a local Node.js service and opens your default browser at `http://127.0.0.1:4318/`. Keep its console open while working. Start it again to reopen the browser; stop it with Ctrl+C or `foliquo stop`.

## Distribution status

Published [platform downloads and SHA256SUMS](https://github.com/gitmaximilian/Foliquo/releases/latest) are available from the latest release. The [official Homebrew tap](https://github.com/gitmaximilian/homebrew-tap) is available. [WinGet submission #462448](https://github.com/microsoft/winget-pkgs/pull/462448) is under review; installation is not publicly available until Microsoft accepts and indexes it.

## macOS

The release pipeline builds separate Apple Silicon and Intel artifacts for macOS 15+. The tested official Node.js 24 LTS runtime and production dependencies, including sharp, are supplied in the matching checksummed archive. LibreOffice Writer is a separate prerequisite:

```sh
brew install --cask libreoffice
```

Install with `brew install gitmaximilian/tap/foliquo`. Start with `foliquo`; check exports with `foliquo doctor`; update with `brew upgrade foliquo`; uninstall with `brew uninstall foliquo`. These operations preserve your private workspace.

## Windows

Download the [Windows x64 installer from the latest release](https://github.com/gitmaximilian/Foliquo/releases/latest) and its checksum from the same release. It installs per user, bundles Node.js and adds **Foliquo Community**, **Stop Foliquo** and an uninstaller to the Start menu. No setup script or administrator access is required for Foliquo itself. An optional desktop shortcut is available. Windows 10 1809+ and Windows 11 x64 are targeted; native Windows ARM64 is not currently built.

Install LibreOffice Writer separately from [LibreOffice](https://www.libreoffice.org/download/), or use `winget install --exact --id TheDocumentFoundation.LibreOffice`. Existing installations are reused. The prepared Foliquo WinGet manifest declares this prerequisite. The Foliquo package ID is intended to be `MaximilianAuer.Foliquo`; do not use an installation command until it is accepted and indexed.

Start from the Start menu. For diagnostics, run the installed `Foliquo.exe doctor` in a terminal. Install the newer verified setup EXE to update. Use Windows **Installed apps** or the Start-menu uninstaller to remove application files. Private data is retained.

The installer is unsigned unless the release's `windows-signature.json` records a verified signature. SmartScreen reputation warnings can occur even for new signed software; WinGet does not remove these checks. Do not disable SmartScreen, Defender or UAC. [Microsoft explains its reputation checks](https://learn.microsoft.com/en-us/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/).

## Linux

The Linux x64 archive targets glibc distributions (Ubuntu 22.04+ or compatible). Install Node.js 22+ (24 LTS recommended), LibreOffice Writer and `xdg-utils` using your distribution's supported packages. No root access is needed by Foliquo's installer.

1. Download the versioned Linux tarball and `SHA256SUMS` from the same [release](https://github.com/gitmaximilian/Foliquo/releases).
2. Check its SHA-256 against the published checksum, then extract it into a normal directory you control.
3. Run `./install.sh` in the extracted directory. It verifies all listed files and tests PDF/Word export before installing.
4. Run `~/.local/bin/foliquo`, or `foliquo` if `~/.local/bin` is on PATH.

Application versions live under `~/.local/share/foliquo-app/versions/`. To update, stop Foliquo, verify and extract the new archive, then run its installer. Old application versions remain for recovery. To uninstall, stop Foliquo, remove the `~/.local/bin/foliquo` symlink and `~/.local/share/foliquo-app` application directory. This leaves the separate private workspace intact. No shell profile or autostart entry is changed.

## Private data and migration

| System | Default private directory |
| --- | --- |
| macOS | `~/Library/Application Support/Foliquo` |
| Windows | `%LOCALAPPDATA%\Foliquo` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/foliquo` |

`foliquo data-dir` prints the selected path. `--data-dir /absolute/path` or `FOLIQUO_DATA_DIR` selects another location. Keep it outside the application installation and use only a directory owned by your account. Unix permissions are restricted to the current user; Windows inherits the user's profile ACL. Do not put private workspaces in shared or synchronised folders.

Legacy `.local` folders are never deleted. When starting a source checkout containing one, Foliquo copies it into an empty default data directory, verifies every file and the encrypted workspace, and keeps the original as a recovery copy. It aborts if the target contains other data, encryption is damaged, ownership is wrong, a symbolic link is present or files change while copying.

Packaged installations cannot discover arbitrary old folders. Stop the old application, then migrate explicitly:

```sh
foliquo migrate --from /absolute/path/to/old/Foliquo/.local
```

On Windows use the installed `Foliquo.exe` in place of `foliquo`. This preserves encryption keys, encrypted documents, provider credentials and preferences. Check the copied workspace before removing any old folder. Migration never merges or overwrites an existing workspace. To use existing data directly, select it with `--data-dir`.

Uninstalling does not erase private data. Removing the private directory separately permanently removes its documents and credentials; retain a verified backup first. The original migration source contains sensitive recovery material too.

## Source setup (available now)

Download and extract the [current source ZIP](https://github.com/gitmaximilian/Foliquo/archive/refs/heads/main.zip), or clone the repository. Install Node.js 22+ and LibreOffice Writer. Open `Setup-Foliquo.cmd` (Windows), `Setup-Foliquo.command` (macOS), or `Setup-Foliquo.sh` (Linux). Later use the matching `Start-Foliquo` file. Developers can run `npm ci --ignore-scripts`, `npm run doctor`, then `npm start`.

Source setup uses package-lock.json and disables npm lifecycle scripts. Linux setup never downloads and executes a remote script or invokes sudo. Legacy TranslateOCR-named wrappers remain only in source for existing users; curated end-user packages omit them.

## Troubleshooting

- **LibreOffice missing:** install Writer and run `foliquo doctor`. The app does not silently disable exports. Use an absolute `TRANSLATEOCR_SOFFICE` override for a custom installation.
- **Port in use:** an existing Foliquo service reopens in the browser. An unrelated service is rejected; choose another port with `FOLIQUO_PORT` (1024–65535).
- **Workspace already in use:** stop the other instance before sharing its data directory. A stale service lock is recovered only when its owner PID no longer exists. An incomplete lock requires checking that all Foliquo processes are stopped before removing `service.lock`.
- **Browser does not open:** open the loopback URL printed in the console. `FOLIQUO_NO_BROWSER=1` supports automated checks.
- **Browser/CLI update available:** the in-app update check links to the version's release page and never installs an update or sends workspace data to GitHub. Windows and macOS desktop apps from v0.11.8 use the signed in-app updater; v0.11.7 must be updated manually once.
