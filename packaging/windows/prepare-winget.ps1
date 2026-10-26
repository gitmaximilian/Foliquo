$ErrorActionPreference = 'Stop'
if (Get-Command winget.exe -ErrorAction SilentlyContinue) { exit 0 }
# Official Microsoft release assets, pinned by version and SHA-256. CI only.
$version = 'v1.29.380'
$base = "https://github.com/microsoft/winget-cli/releases/download/$version"
$work = Join-Path $env:RUNNER_TEMP 'foliquo-winget-validator'
New-Item -ItemType Directory $work -Force | Out-Null
$bundle = Join-Path $work 'Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle'
$dependencies = Join-Path $work 'DesktopAppInstaller_Dependencies.zip'
Invoke-WebRequest "$base/Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle" -OutFile $bundle
Invoke-WebRequest "$base/DesktopAppInstaller_Dependencies.zip" -OutFile $dependencies
if ((Get-FileHash $bundle -Algorithm SHA256).Hash -ne '65DEA9C01CE08EE7B763366B27C0E651F97DB857C11CA9B9C301826C10092F2E') { throw 'WinGet bundle checksum mismatch' }
if ((Get-FileHash $dependencies -Algorithm SHA256).Hash -ne 'BA875AFE9D190F61218985AC0292A99D1DB710BF93E13C68944CA9D89F0D82D1') { throw 'WinGet dependencies checksum mismatch' }
Expand-Archive $dependencies (Join-Path $work 'dependencies') -Force
$paths = @(Get-ChildItem (Join-Path $work 'dependencies/x64/*.appx') | ForEach-Object FullName)
Add-AppxPackage -Path $bundle -DependencyPath $paths
$package = Get-AppxPackage Microsoft.DesktopAppInstaller
if (-not $package) { throw 'Official WinGet registration failed' }
$package.InstallLocation | Out-File -FilePath $env:GITHUB_PATH -Encoding utf8 -Append
