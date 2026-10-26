$ErrorActionPreference = 'Stop'
$office = Join-Path $env:ProgramFiles 'LibreOffice/program/soffice.exe'
for ($attempt=1; $attempt -le 3; $attempt++) {
  if (Test-Path $office) { Write-Host "LibreOffice is available: $office"; exit 0 }
  & choco install libreoffice-fresh -y --no-progress
  # Chocolatey can return zero after a feed timeout without installing a package.
  if (Test-Path $office) { exit 0 }
  if ($attempt -lt 3) { Write-Warning 'LibreOffice download did not install Writer; retrying the package feed.'; Start-Sleep -Seconds 15 }
}
throw 'LibreOffice Writer prerequisite was not installed after three attempts.'
