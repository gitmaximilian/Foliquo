# Foliquo Community Homebrew tap

Foliquo Community is a local browser workspace for document translation under PolyForm Noncommercial 1.0.0. It is source-available with restrictions on commercial use.

Install the published, tested formula:

```sh
brew install --cask libreoffice
brew install gitmaximilian/tap/foliquo
foliquo
```

Update with `brew upgrade foliquo`; stop with `foliquo stop`; verify exports with `foliquo doctor`. Uninstall application code with `brew uninstall foliquo`. Your private data remains in `~/Library/Application Support/Foliquo`.

The formula selects checksummed immutable release assets for Apple Silicon or Intel macOS 15+. The exact official Node.js runtime is bundled in each release; npm is never run at application startup. LibreOffice Writer is a separate cask prerequisite and is not silently installed by the formula.

For legacy installations, stop the old service and use `foliquo migrate --from /path/to/old/.local`. Migration copies and verifies data without deleting the original or overwriting another workspace. See the [setup guide](https://github.com/gitmaximilian/Foliquo/blob/main/docs/BROWSER-SETUP.md).

Maintainers: formulas are generated from actual release artifact checksums by Foliquo's release workflow. Review the generated update and both native architecture checks before merging. Do not use mutable main-branch archives or placeholder checksums.
