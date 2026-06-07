# Wireless ADB — pair then connect (Android 11+)
# Phone: Developer options → Wireless debugging → Pair device with pairing code
# Usage:
#   .\scripts\connect-wireless.ps1 -PairPort 42671 -PairCode 297459 -ConnectPort 42941
# Or after already paired:
#   .\scripts\connect-wireless.ps1 -ConnectPort 42941 -SkipPair

param(
  [string]$PhoneIp = "192.168.0.103",
  [int]$PairPort = 0,
  [string]$PairCode = "",
  [int]$ConnectPort = 0,
  [switch]$SkipPair,
  [switch]$InstallRelease
)

$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$mobile = Split-Path $PSScriptRoot -Parent
$apk = Join-Path $mobile "android\app\build\outputs\apk\release\app-release.apk"

adb kill-server 2>$null | Out-Null
adb start-server | Out-Null

if (-not $SkipPair) {
  if ($PairPort -le 0 -or $PairCode.Length -lt 6) {
    Write-Host "Need -PairPort and -PairCode from phone (Pair with pairing code dialog)." -ForegroundColor Red
    exit 1
  }
  Write-Host "Pairing ${PhoneIp}:${PairPort} ..." -ForegroundColor Yellow
  adb pair "${PhoneIp}:${PairPort}" $PairCode
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($ConnectPort -le 0) {
  Write-Host "Need -ConnectPort from Wireless debugging screen (IP address & Port)." -ForegroundColor Red
  exit 1
}

Write-Host "Connecting ${PhoneIp}:${ConnectPort} ..." -ForegroundColor Yellow
adb connect "${PhoneIp}:${ConnectPort}"
Start-Sleep -Seconds 2
adb devices -l

$serial = "${PhoneIp}:${ConnectPort}"
$state = adb -s $serial get-state 2>&1
if ($state -notmatch "device") {
  Write-Host "Device not online. Re-open pairing dialog and run again with fresh -PairPort/-PairCode." -ForegroundColor Red
  exit 1
}

if ($InstallRelease) {
  if (-not (Test-Path $apk)) {
    Write-Host "Release APK missing. Run build_apk_release.ps1 first." -ForegroundColor Red
    exit 1
  }
  Write-Host "Installing release APK ..." -ForegroundColor Green
  adb -s $serial install -r $apk
}

Write-Host "Connected: $serial" -ForegroundColor Green
