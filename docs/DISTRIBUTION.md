# Distribution architecture and maintainer runbook

## Audit and decisions

The previous tag archives were full source checkouts. GitHub's automatic source ZIP/tarball assets contain developer material by design and are historical immutable archives. They remain available and are not rewritten. Custom assets now use an explicit application allowlist in scripts/package-release.mjs.

| Candidate | Classification | New end-user package |
| --- | --- | --- |
| server.mjs, imported lib modules, bin CLI, dist UI/vendor/fonts/demo assets | Runtime | Included |
| Locked production node_modules and native sharp binaries | Runtime | Installed during the build for its OS/architecture, included with licenses |
| package.json, package-lock.json, doctor script, distribution.json | Installation/runtime verification | Included |
| Linux install.sh and scripts/install-linux.mjs | Installation | Linux only |
| Windows Node runtime, native console launcher, prerequisite note | Installation/runtime | Windows only |
| LICENSE, third-party notices and INSTALL.md | Licensing/documentation | Included |
| AGENTS, handover, planning/research notes, .github, tests, benchmarks, source brand artwork, screenshots | Developer-only | Excluded |
| Setup/Start-TranslateOCR wrappers | Legacy compatibility | Source only; retained to forward existing users |
| Old Setup-Windows/native package scripts deleted before this change | Obsolete | Not reintroduced |
| .local, user documents, credentials, outputs, caches, .git, .env | Private/generated | Excluded; packaging rejects prohibited paths |

Production npm package contents are retained as supplied upstream so runtime modules and licensing notices are not accidentally removed. No npm install or runtime download occurs on application startup. The artifacts' dependency resolution is pinned by package-lock.json; platform-specific native packages are installed and smoke-tested on their target runner. POSIX archives normalize owner, permissions and timestamps using the source commit time. Rebuilding fictional demo exports and Authenticode timestamps can change bytes; immutable per-release checksums identify the published result. Reproducible inputs do not imply identical signed EXE bytes.

A full native desktop frontend is unnecessary. Inno Setup provides a per-user EXE installer around the existing Node/browser architecture. Its installer/uninstaller, branding, Start menu, upgrade support and silent modes fit WinGet; raw BAT/PowerShell installers do not. The native C# console launcher invokes only the bundled Node executable and carries the release's version metadata. No background persistence is installed.

Homebrew installs immutable macOS ARM64/Intel application archives into libexec and supplies Node.js 24 LTS. This avoids npm downloads or native compilation during end-user installation. LibreOffice is a separate cask; formula caveats, startup and doctor provide an explicit prerequisite check. Linux uses a versioned tarball and a user-local installer; additional package formats offer insufficient value for the maintenance cost. The current packaged targets are macOS 15+ ARM64/x64, Windows 10/11 x64, and Linux x64/glibc 2.35+. Untested targets are not advertised.

## Lifecycle and data

Source setup installs locked dependencies; packaged setup does not run npm. `foliquo` resolves its own installation root, checks a loopback health endpoint, rejects an unrelated service, verifies LibreOffice availability, starts the backend and opens the default browser. The console owns the service; Ctrl+C, SIGTERM or `foliquo stop` flushes the workspace and closes the backend. A separate workspace lock prevents simultaneous writers across ports. The stop endpoint requires a random bearer secret stored only in a private service record; other browser origins cannot stop it.

The platform data directory is independent of application versions. Migration verifies the encrypted payload and key, copies all legacy files into a private staging directory, checks source/copy hashes, and atomically adopts an empty destination. The source remains the recovery backup. Conflicts, links, wrong ownership and corruption fail without overwriting. An override supports using a verified existing directory. Uninstallers remove code only. See BROWSER-SETUP.md for commands and recovery.

## Release procedure

1. Update package version and lockfile together; add docs/RELEASE-X.Y.Z.md. Review the pinned Node patch in .node-version and dependency security advisories.
2. Run npm test, npm run benchmark, npm run acceptance, npm run demo:build and npm run package. Review generated package contents and license notices.
3. Push a branch and manually dispatch **Build and release distributions** against it. This builds and tests without publishing. Review all four native build jobs, both Homebrew jobs and the official WinGet validator.
4. After success, merge the exact reviewed change and create its version tag. The tag workflow verifies version consistency, dependencies, tests, exports and installation behavior; generates checksums/formula/manifests; stages all assets in a draft; and publishes only after all gates succeed. It refuses to replace an existing release.
5. Publish the generated homebrew-tap/ directory to gitmaximilian/homebrew-tap and verify installation from the actual public URL. The follow-up workflow can open an update PR when TAP_GITHUB_TOKEN is configured as a fine-grained token limited to contents/pull-requests for that tap. The repository's ordinary workflow token cannot write to another repository.
6. Validate the generated WinGet directory with `winget validate --manifest <directory> --disable-interactivity`. After the public installer URL is verified and actual installer tests pass, use WinGetCreate or a fork of microsoft/winget-pkgs to submit that directory. Submit only the version's manifests. Record PR, review, merge and index status separately. Update README/site installation commands only after public availability is confirmed.
7. Review windows-signature.json. Optional WINDOWS_SIGNING_PFX_BASE64 and WINDOWS_SIGNING_PASSWORD secrets enable Authenticode signing and signature verification. No certificate or reputation is invented. Keep signing credentials in Actions secrets; never commit them. Apple code signing/notarization and Windows signing/reputation improve distribution trust but are not claimed by a checksum or package-manager submission.

A failed run leaves no published release. A publish-stage network failure can leave a draft; inspect and remove/recreate that draft deliberately rather than overwriting existing assets. GitHub release publication by a workflow token may not trigger another workflow; use the manual tag input on **Prepare package manager updates** when needed. Missing tap credentials produce a downloadable update artifact and a clear report.

## Verification boundaries

Automated checks cover synthetic migration, encrypted bytes/keys, conflicting targets, damaged payloads, foreign service detection, start from another directory, repeated launch, protected stop, native module loading, PDF/Word conversion, curated checksums and packaged installation lifecycle. Windows installer tests exercise actual silent installation, bundled runtime with system Node excluded from PATH, Start-menu entries, browser-service startup, repeat launch, export doctor, reinstall and uninstall/data preservation. Homebrew tests use the exact release bytes through local prepublication URLs before testing public URLs in the tap. Browser opening is checked locally; hosted runners suppress it. A same-version reinstall exercises file replacement but is not a historical-version upgrade test. Windows clean-account visual/SmartScreen behavior and an actual old-to-new installer upgrade still need separate manual acceptance evidence.

References: [Homebrew taps](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap), [language-specific formulas](https://docs.brew.sh/Language-Specific-Formulae), [WinGet manifests](https://learn.microsoft.com/windows/package-manager/package/manifest), [submission process](https://learn.microsoft.com/windows/package-manager/package/repository), [Inno Setup license](https://jrsoftware.org/files/is/license.txt), [SmartScreen](https://learn.microsoft.com/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/).
