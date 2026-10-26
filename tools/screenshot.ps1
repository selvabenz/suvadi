# Take phone-sized screenshots of a running build with headless Edge.
# Usage: powershell -NoProfile -File tools/screenshot.ps1 -Url http://localhost:4173/ -Out shots
param(
  [string]$Url = 'http://localhost:4173/',
  [string]$Out = (Join-Path $env:TEMP 'suvadi-shots'),
  [int]$Width = 390,
  [int]$Height = 844
)
$ErrorActionPreference = 'Stop'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Google\Chrome\Application\chrome.exe' }
New-Item -ItemType Directory -Force $Out | Out-Null
$profile = Join-Path $env:TEMP 'suvadi-shot-profile'
$png = Join-Path $Out 'read.png'
if (Test-Path $png) { Remove-Item $png -Force }
$args = @('--headless=new', '--disable-gpu', '--hide-scrollbars', "--user-data-dir=$profile",
          "--window-size=$Width,$Height", '--virtual-time-budget=8000', "--screenshot=$png", $Url)
$p = Start-Process -FilePath $edge -ArgumentList $args -Wait -PassThru -WindowStyle Hidden
if (-not (Test-Path $png)) { throw "no screenshot written (edge exit $($p.ExitCode))" }
Write-Host "wrote $png"
