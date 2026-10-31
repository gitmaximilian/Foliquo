$ErrorActionPreference = 'Stop'
$tag = $env:RELEASE_TAG
if ($tag -notmatch '^v[0-9]+\.[0-9]+\.[0-9]+$') { throw 'Use a published semantic version tag.' }
$version = $tag.Substring(1)
$release = gh api "repos/gitmaximilian/Foliquo/releases/tags/$tag" | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $release.draft) { throw 'A public release is required.' }
$work = Join-Path $env:RUNNER_TEMP 'foliquo-winget-acceptance'
New-Item -ItemType Directory $work -Force | Out-Null
$bundleName = "Foliquo-Packaging-$version.zip"
gh release download $tag --repo gitmaximilian/Foliquo --pattern $bundleName --pattern SHA256SUMS --dir $work
if ($LASTEXITCODE -ne 0) { throw 'Release metadata download failed.' }
$entry = Get-Content (Join-Path $work 'SHA256SUMS') | Where-Object { $_ -match ('^[a-f0-9]{64}\s+' + [regex]::Escape($bundleName) + '$') }
if (-not $entry -or (Get-FileHash (Join-Path $work $bundleName) -Algorithm SHA256).Hash -ne ($entry -split '\s+')[0]) { throw 'Metadata checksum mismatch.' }
Expand-Archive (Join-Path $work $bundleName) (Join-Path $work 'metadata')
$manifest = Join-Path $work "metadata/winget/manifests/m/MaximilianAuer/Foliquo/$version"
$winget = (Get-Command winget.exe).Source
& $winget --version
& $winget validate --manifest $manifest --disable-interactivity
if ($LASTEXITCODE -ne 0) { throw 'Official manifest validation failed.' }
# Local manifest testing is enabled only in this disposable CI account; OS security protections stay enabled.
& $winget settings --enable LocalManifestFiles
if ($LASTEXITCODE -ne 0) { throw 'Local manifest testing could not be enabled.' }
$env:FOLIQUO_DATA_DIR = Join-Path $work 'synthetic-private-data'
$env:FOLIQUO_NO_BROWSER = '1'
$env:FOLIQUO_PORT = '18343'
# LibreOffice is preinstalled by this test job; dependency installation is tested separately by Microsoft's package review.
$installerLog = Join-Path $work 'installer.log'
$stdoutLog = Join-Path $work 'winget-install.stdout.log'
$stderrLog = Join-Path $work 'winget-install.stderr.log'
$installArgs = 'install --manifest "' + $manifest + '" --silent --disable-interactivity --skip-dependencies --accept-package-agreements --accept-source-agreements --log "' + $installerLog + '"'
$install = Start-Process $winget -ArgumentList $installArgs -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
if (-not $install.WaitForExit(480000)) {
  Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'winget|Foliquo|Setup' } | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine | Format-List | Out-String | Write-Host
  foreach ($log in @($stdoutLog,$stderrLog,$installerLog)) { if (Test-Path $log) { Get-Content $log -Tail 60 | Write-Host } }
  Stop-Process -Id $install.Id -Force
  throw 'WinGet installation exceeded eight minutes; inspect the attached installer diagnostics.'
}
Get-Content $stdoutLog | Write-Host
Get-Content $stderrLog | Write-Host
if ($install.ExitCode -ne 0) { throw "WinGet could not install the actual public installer: $($install.ExitCode)" }
$launcher = Join-Path $env:LOCALAPPDATA 'Programs/Foliquo/Foliquo.exe'
if (-not (Test-Path $launcher)) { throw 'Installed launcher is missing.' }
if ((& $launcher --version).Trim() -ne $version) { throw 'Installed version is incorrect.' }
& $launcher doctor
if ($LASTEXITCODE -ne 0) { throw 'Installed export check failed.' }
$process = Start-Process $launcher -PassThru
try {
  $ready = $false
  for ($i=0; $i -lt 60; $i++) {
    try { if ((Invoke-RestMethod 'http://127.0.0.1:18343/api/health').application -eq 'foliquo') { $ready=$true; break } } catch {}
    Start-Sleep -Milliseconds 250
  }
  if (-not $ready) { throw 'WinGet-installed application did not start.' }
  & $launcher stop
  if ($LASTEXITCODE -ne 0) { throw 'Application did not stop.' }
  $process.WaitForExit(10000) | Out-Null
  if (-not $process.HasExited) { throw 'Application remained running.' }
} finally { if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force } }
$key = (Get-FileHash (Join-Path $env:FOLIQUO_DATA_DIR 'workspace.key') -Algorithm SHA256).Hash
& $winget uninstall --id MaximilianAuer.Foliquo --exact --silent --disable-interactivity --accept-source-agreements
if ($LASTEXITCODE -ne 0) { throw 'WinGet uninstall by package ID failed.' }
if (Test-Path $launcher) { throw 'WinGet uninstall left application files.' }
if ((Get-FileHash (Join-Path $env:FOLIQUO_DATA_DIR 'workspace.key') -Algorithm SHA256).Hash -ne $key) { throw 'WinGet uninstall damaged private data.' }
@{version=$version;validator='v1.29.380';validation='passed';install='passed';start='passed';exports='passed';uninstall='passed';dataPreservation='passed';dependencyNote='LibreOffice preinstalled for this isolated test'} | ConvertTo-Json | Set-Content 'winget-acceptance.json'
