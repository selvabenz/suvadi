# Render public/icons/icon.svg to the two PNG sizes the web manifest needs,
# using the Edge browser already present on Windows (no image library needed).
# Run from anywhere: powershell -NoProfile -File tools/make_icons.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$svg = Join-Path $root 'public\icons\icon.svg'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Google\Chrome\Application\chrome.exe' }
$profile = Join-Path $env:TEMP 'suvadi-icon-profile'
foreach ($size in 192, 512) {
  $out = Join-Path $root "public\icons\icon-$size.png"
  if (Test-Path $out) { Remove-Item $out -Force }
  $html = Join-Path $env:TEMP "icon-$size.html"
  $svgUri = 'file:///' + ($svg -replace '\\', '/')
  "<html><body style='margin:0;background:#5b3a1e'><img src='$svgUri' width='$size' height='$size' style='display:block'></body></html>" |
    Out-File -Encoding ascii $html
  $args = @('--headless=new', '--disable-gpu', '--hide-scrollbars', "--user-data-dir=$profile",
            "--window-size=$size,$size", "--screenshot=$out", ('file:///' + ($html -replace '\\', '/')))
  # Start-Process: Edge writes chatter to stderr, which must not become a PowerShell error.
  $p = Start-Process -FilePath $edge -ArgumentList $args -Wait -PassThru -WindowStyle Hidden
  if (-not (Test-Path $out)) { throw "no PNG written for $size (edge exit $($p.ExitCode))" }
  Write-Host "wrote $out"
}
