$ErrorActionPreference = 'Stop'
$version = (Get-Content package.json | ConvertFrom-Json).version
$setup = (Resolve-Path "release/Foliquo-Community-$version-Windows-x64-Setup.exe").Path
$install = Join-Path $env:RUNNER_TEMP 'Foliquo installation with spaces'
$env:FOLIQUO_DATA_DIR = Join-Path $env:RUNNER_TEMP 'Foliquo synthetic private data'
$env:FOLIQUO_NO_BROWSER = '1'
$env:FOLIQUO_PORT = '18319'
function Install-Foliquo {
  $process = Start-Process -FilePath $setup -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/SP-',"/DIR=`"$install`"") -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
}
Install-Foliquo
$launcher = Join-Path $install 'Foliquo.exe'
if (-not (Test-Path "$env:APPDATA/Microsoft/Windows/Start Menu/Programs/Foliquo Community/Foliquo Community.lnk")) { throw 'Start menu shortcut is missing' }
$expectedNode = (Get-Content .node-version).Trim()
if ((& "$install/runtime/node.exe" --version).Trim() -ne "v$expectedNode") { throw 'Bundled runtime version mismatch' }
# Exclude system Node.js. The installed executable must use only its bundled runtime.
$savedPath = $env:PATH
$env:PATH = "$env:SystemRoot\System32;$env:SystemRoot"
Push-Location $env:RUNNER_TEMP
try {
  & $launcher --version
  if ($LASTEXITCODE -ne 0) { throw 'Launcher requires external Node.js' }
  $running = Start-Process -FilePath $launcher -PassThru
  try {
    $ready = $false
    for ($i=0; $i -lt 60; $i++) {
      try { $health = Invoke-RestMethod 'http://127.0.0.1:18319/api/health'; if ($health.application -eq 'foliquo') { $ready=$true; break } } catch {}
      Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw 'Installed server did not start' }
    & $launcher
    if ($LASTEXITCODE -ne 0) { throw 'Repeated launch failed' }
    & $launcher doctor
    if ($LASTEXITCODE -ne 0) { throw 'Installed PDF/DOCX export check failed' }
    & $launcher stop
    $running.WaitForExit(10000) | Out-Null
    if (-not $running.HasExited) { throw 'Server did not stop' }
  } finally { if (-not $running.HasExited) { Stop-Process -Id $running.Id -Force } }
} finally { Pop-Location; $env:PATH=$savedPath }
$key = (Get-FileHash "$env:FOLIQUO_DATA_DIR/workspace.key" -Algorithm SHA256).Hash
Install-Foliquo
if ((Get-FileHash "$env:FOLIQUO_DATA_DIR/workspace.key" -Algorithm SHA256).Hash -ne $key) { throw 'Upgrade changed encryption key' }
$uninstall = Start-Process "$install/unins000.exe" -ArgumentList '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART' -Wait -PassThru
if ($uninstall.ExitCode -ne 0) { throw 'Uninstaller failed' }
if (Test-Path $launcher) { throw 'Application was not removed' }
if ((Get-FileHash "$env:FOLIQUO_DATA_DIR/workspace.key" -Algorithm SHA256).Hash -ne $key) { throw 'Uninstall removed private data' }
Write-Output 'Actual installer, bundled Node, Start menu, startup, repeated launch, exports, reinstall/upgrade and uninstall passed.'
