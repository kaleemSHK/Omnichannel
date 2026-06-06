# Production APK - bundles JS inside the APK (no Metro required on device).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$prodEnv = Join-Path $root ".env.production.example"
$envFile = Join-Path $root ".env"
if (Test-Path $prodEnv) {
  Copy-Item -Force $prodEnv $envFile
  Write-Host "Using production .env from .env.production.example"
} elseif (-not (Test-Path $envFile)) {
  throw "Missing .env - copy .env.production.example to .env first"
}

$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:ANDROID_HOME = "C:\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

Set-Location (Join-Path $root "android")
# Real phones use ARM; omit x86_64 unless you need emulator-only APK.
& ".\gradlew.bat" assembleRelease "-PreactNativeArchitectures=arm64-v8a,armeabi-v7a" --no-daemon
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$apk = Join-Path $root "android\app\build\outputs\apk\release\app-release.apk"
Write-Host ""
Write-Host "Production APK:"
Write-Host $apk
Write-Host ('Install: adb install -r "' + $apk + '"')
