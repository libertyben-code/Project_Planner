# build-release.ps1 — Build Tauri release and produce a versioned EXE for testing
# Usage: .\scripts\build-release.ps1
# Run from the project root.

$ErrorActionPreference = 'Stop'

$tauriConf = Get-Content "$PSScriptRoot\..\src-tauri\tauri.conf.json" -Raw | ConvertFrom-Json
$version   = $tauriConf.version
$releaseDir = "$PSScriptRoot\..\src-tauri\target\release"
$srcExe     = "$releaseDir\wms-planner.exe"
$destExe    = "$releaseDir\WMSPlanner_$version.exe"

Write-Host ""
Write-Host "Building WMS Planner v$version..." -ForegroundColor Cyan

Set-Location "$PSScriptRoot\.."
npx tauri build

if (-not (Test-Path $srcExe)) {
    Write-Error "Build output not found at $srcExe"
    exit 1
}

Copy-Item $srcExe $destExe -Force

Write-Host ""
Write-Host "Build complete." -ForegroundColor Green
Write-Host "  Versioned EXE : $destExe" -ForegroundColor Cyan
Write-Host "  NSIS installer: src-tauri\target\release\bundle\nsis\WMS Project Planner_${version}_x64-setup.exe"
Write-Host ""
