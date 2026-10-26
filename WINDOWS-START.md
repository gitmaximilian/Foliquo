# Foliquo Community on Windows

Follow the [current Windows installation guide](docs/BROWSER-SETUP.md#windows). Verified releases provide a per-user x64 setup EXE with Node.js, Start-menu shortcuts and an uninstaller. LibreOffice Writer is a separate prerequisite. Foliquo WinGet availability must be confirmed in the README; a generated manifest is not an indexed package.

Start **Foliquo Community** from the Start menu and keep its console open. **Stop Foliquo** shuts down the local service. Install the newer verified setup EXE to update; uninstall through Installed apps. Private data in `%LOCALAPPDATA%\Foliquo` is retained.

Before migrating an older source installation, stop it and keep its `.local` directory. The setup guide explains verified copying with `Foliquo.exe migrate --from "C:\path\to\old\.local"`.

Source users can install Node.js 22+ and LibreOffice Writer, extract the source ZIP, then run `Setup-Foliquo.cmd`. Later use `Start-Foliquo.cmd`. Both use the same CLI as packaged installations; setup never needs to be run after installing the EXE.
