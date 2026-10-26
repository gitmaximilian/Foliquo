import {readFile,writeFile,mkdir,readdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CURRENT_VERSION as version} from '../lib/version.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),directory=resolve(process.argv[2]||join(root,'release'));
const base=`https://github.com/gitmaximilian/Foliquo/releases/download/v${version}`,prefix=`Foliquo-Community-${version}`;
const names=[`${prefix}-macOS-arm64.tar.gz`,`${prefix}-macOS-x64.tar.gz`,`${prefix}-Linux-x64.tar.gz`,`${prefix}-Windows-x64-Setup.exe`];
const checksums={};for(const name of names)checksums[name]=createHash('sha256').update(await readFile(join(directory,name))).digest('hex');
await writeFile(join(directory,'SHA256SUMS'),Object.entries(checksums).map(([name,hash])=>`${hash}  ${name}`).join('\n')+'\n');
const tap=join(directory,'homebrew-tap');await cp(join(root,'packaging/homebrew'),tap,{recursive:true});await mkdir(join(tap,'Formula'),{recursive:true});
await writeFile(join(tap,'Formula','foliquo.rb'),`class Foliquo < Formula
  desc "Local browser workspace for noncommercial document translation"
  homepage "https://maximilianauer.at/projects/foliquo/"
  version "${version}"
  license "PolyForm-Noncommercial-1.0.0"

  on_macos do
    on_arm do
      url "${base}/${prefix}-macOS-arm64.tar.gz"
      sha256 "${checksums[`${prefix}-macOS-arm64.tar.gz`]}"
    end
    on_intel do
      url "${base}/${prefix}-macOS-x64.tar.gz"
      sha256 "${checksums[`${prefix}-macOS-x64.tar.gz`]}"
    end
  end

  depends_on :macos
  depends_on macos: :sequoia
  # The supported and tested release runtime; native dependencies are built on each architecture.
  depends_on "node@24"

  def install
    libexec.install Dir["*"]
    (bin/"foliquo").write <<~SH
      #!/bin/sh
      exec "#{Formula["node@24"].opt_bin}/node" "#{libexec}/bin/foliquo.mjs" "$@"
    SH
    (bin/"foliquo").chmod 0o755
  end

  def caveats
    <<~EOS
      LibreOffice Writer is required for PDF/Word processing and export:
        brew install --cask libreoffice
      Verify exports: foliquo doctor
      Start: foliquo; stop: foliquo stop; update: brew upgrade foliquo
      Data: ~/Library/Application Support/Foliquo (preserved on uninstall).
      Migrate an old workspace: foliquo migrate --from /path/to/old/.local
      Foliquo Community uses PolyForm Noncommercial 1.0.0; commercial use is restricted.
    EOS
  end

  test do
    assert_equal version.to_s, shell_output("#{bin}/foliquo --version").strip
    cd libexec do
      system Formula["node@24"].opt_bin/"node", "--input-type=module", "-e",
             "import sharp from 'sharp'; await sharp({create:{width:1,height:1,channels:3,background:'white'}}).png().toBuffer()"
    end
    ENV["FOLIQUO_DATA_DIR"] = (testpath/"private-data").to_s
    ENV["FOLIQUO_NO_BROWSER"] = "1"
    ENV["FOLIQUO_PORT"] = free_port.to_s
    pid = fork { exec bin/"foliquo" }
    begin
      sleep 3
      assert_match "foliquo", shell_output("curl --fail --silent http://127.0.0.1:#{ENV.fetch("FOLIQUO_PORT")}/api/health")
      system bin/"foliquo"
      system bin/"foliquo", "stop"
      Process.wait pid
      assert_path_exists testpath/"private-data/workspace.key"
    ensure
      Process.kill("TERM", pid) rescue nil
    end
  end
end
`);
const manifests=join(directory,'winget','manifests','m','MaximilianAuer','Foliquo',version);await mkdir(manifests,{recursive:true});
const schema='1.12.0',id='MaximilianAuer.Foliquo',common=`PackageIdentifier: ${id}\nPackageVersion: ${version}\n`;
await writeFile(join(manifests,`${id}.yaml`),common+`DefaultLocale: en-US\nManifestType: version\nManifestVersion: ${schema}\n`);
await writeFile(join(manifests,`${id}.locale.en-US.yaml`),common+`PackageLocale: en-US
Publisher: Maximilian Auer
PublisherUrl: https://maximilianauer.at/
PackageName: Foliquo Community
PackageUrl: https://maximilianauer.at/projects/foliquo/
License: PolyForm Noncommercial 1.0.0
LicenseUrl: https://github.com/gitmaximilian/Foliquo/blob/v${version}/LICENSE
ShortDescription: Local browser workspace for noncommercial document translation.
Description: Local-first PDF and Word translation with a browser interface. LibreOffice Writer is required.
ReleaseNotesUrl: https://github.com/gitmaximilian/Foliquo/releases/tag/v${version}
ManifestType: defaultLocale
ManifestVersion: ${schema}
`);
await writeFile(join(manifests,`${id}.installer.yaml`),common+`InstallerType: inno
Scope: user
MinimumOSVersion: 10.0.17763.0
InstallModes:
  - interactive
  - silent
  - silentWithProgress
UpgradeBehavior: install
InstallerSwitches:
  Silent: /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-
  SilentWithProgress: /SILENT /SUPPRESSMSGBOXES /NORESTART /SP-
Dependencies:
  PackageDependencies:
    - PackageIdentifier: TheDocumentFoundation.LibreOffice
AppsAndFeaturesEntries:
  - DisplayName: Foliquo Community
    Publisher: Maximilian Auer
    ProductCode: '{71E40B4D-1908-4B10-B2E7-4BA734955E32}_is1'
Installers:
  - Architecture: x64
    InstallerUrl: ${base}/${prefix}-Windows-x64-Setup.exe
    InstallerSha256: ${checksums[`${prefix}-Windows-x64-Setup.exe`].toUpperCase()}
ManifestType: installer
ManifestVersion: ${schema}
`);
await writeFile(join(directory,'release-report.json'),JSON.stringify({version,artifacts:checksums,homebrew:'generated; publish only after formula tests pass',winget:'generated; validation, Microsoft review and indexing are separate steps',signing:'unsigned unless the signing job and Authenticode verification succeeded'},null,2)+'\n');
console.log('Checksums, Homebrew formula and WinGet manifests generated from actual artifacts.');
