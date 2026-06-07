# Connect Android phone for BlinkOne mobile debug (Windows)
# 1. Phone: Settings → Developer options → USB debugging ON
# 2. Connect USB cable → tap "Allow" on phone when prompted
# 3. Run: .\scripts\connect-device.ps1

$ErrorActionPreference = "Stop"
Write-Host "=== BlinkOne Mobile — Device Debug ===" -ForegroundColor Cyan

adb kill-server 2>$null
adb start-server
Write-Host ""
Write-Host "Connected devices:" -ForegroundColor Yellow
adb devices -l

$devices = adb devices | Select-String "device$" | Where-Object { $_ -notmatch "List of devices" }
if (-not $devices) {
  Write-Host ""
  Write-Host "No device found. Check:" -ForegroundColor Red
  Write-Host "  • USB cable connected"
  Write-Host "  • USB debugging enabled (Developer options)"
  Write-Host "  • Tap 'Allow USB debugging' on phone"
  Write-Host "  • Try: adb tcpip 5555  (then wireless if needed)"
  exit 1
}

Write-Host ""
Write-Host "Starting Metro bundler in background..." -ForegroundColor Green
$mobileRoot = Split-Path $PSScriptRoot -Parent
Set-Location $mobileRoot

# Start Metro if not running
$metro = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "react-native" }
if (-not $metro) {
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$mobileRoot'; npm start" -WindowStyle Minimized
  Start-Sleep -Seconds 5
}

Write-Host "Building and installing debug APK on device..." -ForegroundColor Green
npm run android

Write-Host ""
Write-Host "Done. Shake phone → Reload if needed." -ForegroundColor Cyan
