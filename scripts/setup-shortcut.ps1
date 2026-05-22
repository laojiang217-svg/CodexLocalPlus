param(
  [Parameter(Mandatory = $true)]
  [string]$TargetPath,
  [string]$Arguments = "",
  [string]$Name = "Codex Local Plus",
  [switch]$Desktop,
  [switch]$StartMenu
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $TargetPath)) {
  throw "Shortcut target does not exist: $TargetPath"
}

if (-not $Desktop -and -not $StartMenu) {
  $Desktop = $true
}

$paths = @()
if ($Desktop) {
  $paths += (Join-Path ([Environment]::GetFolderPath("Desktop")) "$Name.lnk")
}
if ($StartMenu) {
  $programs = [Environment]::GetFolderPath("Programs")
  $paths += (Join-Path $programs "$Name.lnk")
}

$wsh = New-Object -ComObject WScript.Shell
foreach ($path in $paths) {
  $parent = Split-Path -Parent $path
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }

  $shortcut = $wsh.CreateShortcut($path)
  $shortcut.TargetPath = $TargetPath
  $shortcut.Arguments = $Arguments
  $shortcut.WorkingDirectory = $env:USERPROFILE
  $shortcut.Description = "Start Codex with Codex Local Plus"
  $shortcut.Save()

  Write-Host "Created shortcut: $path"
}
