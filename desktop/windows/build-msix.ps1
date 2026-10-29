$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$target = Join-Path $root 'desktop/src-tauri/target/release'
$binary = Join-Path $target 'foliquo-desktop.exe'
$resources = Join-Path $root 'desktop/generated'
$package = Join-Path $root "release-desktop/Foliquo-Desktop-$version-Windows-x64-Store-intake.msix"
$stage = Join-Path $root 'release-desktop/msix-stage'
if (-not (Test-Path $binary) -or -not (Test-Path (Join-Path $resources 'service/runtime/node.exe')) -or -not (Test-Path (Join-Path $resources 'office/LibreOffice/program/soffice.exe'))) {
  throw 'The Windows desktop binary and complete resources must be built before MSIX packaging.'
}
$sdk = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\makeappx.exe" | Sort-Object FullName | Select-Object -Last 1
if (-not $sdk) { throw 'Windows SDK MakeAppx.exe is required.' }
New-Item (Split-Path $package -Parent) -ItemType Directory -Force | Out-Null
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
if (Test-Path $package) { Remove-Item $package -Force }
New-Item $stage -ItemType Directory -Force | Out-Null
Copy-Item $binary (Join-Path $stage 'Foliquo.exe')
Copy-Item (Join-Path $resources 'service') (Join-Path $stage 'service') -Recurse
Copy-Item (Join-Path $resources 'office') (Join-Path $stage 'office') -Recurse
New-Item (Join-Path $stage 'Assets') -ItemType Directory | Out-Null
Copy-Item (Join-Path $root 'desktop/windows/Assets/Square150x150Logo.png') (Join-Path $stage 'Assets/Square150x150Logo.png')
Copy-Item (Join-Path $root 'desktop/windows/Assets/Square44x44Logo.png') (Join-Path $stage 'Assets/Square44x44Logo.png')
$manifest = (Get-Content (Join-Path $root 'desktop/windows/AppxManifest.xml.in') -Raw).Replace('@VERSION@', $version)
[IO.File]::WriteAllText((Join-Path $stage 'AppxManifest.xml'), $manifest, [Text.UTF8Encoding]::new($false))
& $sdk.FullName pack /o /h SHA256 /d $stage /p $package
if ($LASTEXITCODE -ne 0) { throw 'MakeAppx failed.' }
if (-not (Test-Path $package) -or (Get-Item $package).Length -lt 1MB) { throw 'The MSIX package is missing or unexpectedly small.' }
Write-Host "Built unsigned MSIX Store-intake candidate: $package"
