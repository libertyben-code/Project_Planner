# bump-version.ps1 — Update version in Cargo.toml and tauri.conf.json
# Usage: .\scripts\bump-version.ps1 1.2.0

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Version
)

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Error "Version must be in MAJOR.MINOR.PATCH format (e.g. 1.2.0)"
    exit 1
}

$cargoPath  = "$PSScriptRoot\..\src-tauri\Cargo.toml"
$tauriPath  = "$PSScriptRoot\..\src-tauri\tauri.conf.json"

# UTF-8 without BOM writer (PowerShell 5.1 -Encoding utf8 adds BOM — this does not)
$utf8 = [System.Text.UTF8Encoding]::new($false)

# --- Cargo.toml ---
$cargo = Get-Content $cargoPath -Raw
$cargo = $cargo -replace '(?m)^version = "\d+\.\d+\.\d+"', "version = `"$Version`""
[System.IO.File]::WriteAllText($cargoPath, $cargo, $utf8)

# --- tauri.conf.json ---
$tauri = Get-Content $tauriPath -Raw | ConvertFrom-Json
$tauri.version = $Version
[System.IO.File]::WriteAllText($tauriPath, ($tauri | ConvertTo-Json -Depth 10), $utf8)

Write-Host ""
Write-Host "Version bumped to $Version" -ForegroundColor Green
Write-Host ""
Write-Host "Files updated:" -ForegroundColor Cyan
Write-Host "  src-tauri/Cargo.toml"
Write-Host "  src-tauri/tauri.conf.json"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  git add src-tauri/Cargo.toml src-tauri/tauri.conf.json"
Write-Host "  git commit -m `"chore: bump version to $Version`""
Write-Host "  git push"
Write-Host ""
Write-Host "Installer output will be named:"
Write-Host "  WMS Project Planner_${Version}_x64-setup.exe" -ForegroundColor Cyan
