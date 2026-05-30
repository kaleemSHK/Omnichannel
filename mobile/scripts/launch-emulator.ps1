# BlinkOne Emulator Setup & Launch Script
$ANDROID_HOME = "C:\Android\Sdk"
$AVD_NAME = "BlinkOne_Pixel9"
$APK = "E:\BlinkOne\mobile\android\app\build\outputs\apk\release\app-release.apk"

Write-Host "=== BlinkOne Emulator Launcher ===" -ForegroundColor Cyan

# 1. Create AVD if it doesn't exist
$avdList = & "$ANDROID_HOME\cmdline-tools\latest\bin\avdmanager.bat" list avd 2>&1
if ($avdList -notmatch $AVD_NAME) {
    Write-Host "Creating AVD '$AVD_NAME'..." -ForegroundColor Yellow
    & "$ANDROID_HOME\cmdline-tools\latest\bin\avdmanager.bat" create avd `
        --name $AVD_NAME `
        --package "system-images;android-35;google_apis;x86_64" `
        --device "pixel_9" `
        --force 2>&1
    Write-Host "AVD created." -ForegroundColor Green
} else {
    Write-Host "AVD '$AVD_NAME' already exists." -ForegroundColor Green
}

# 2. Launch emulator in background
Write-Host "Launching emulator..." -ForegroundColor Yellow
$emu = Start-Process `
    -FilePath "$ANDROID_HOME\emulator\emulator.exe" `
    -ArgumentList "-avd $AVD_NAME -no-snapshot-load -gpu auto" `
    -PassThru

Write-Host "Waiting for emulator to boot (this takes ~1-2 minutes)..." -ForegroundColor Yellow
& "$ANDROID_HOME\platform-tools\adb.exe" wait-for-device

# Wait for full boot
Write-Host "Waiting for full boot..." -ForegroundColor Yellow
do {
    Start-Sleep -Seconds 3
    $bootStatus = & "$ANDROID_HOME\platform-tools\adb.exe" shell getprop sys.boot_completed 2>&1
} while ($bootStatus.Trim() -ne "1")

Write-Host "Emulator fully booted!" -ForegroundColor Green

# 3. Install BlinkOne APK
Write-Host "Installing BlinkOne APK..." -ForegroundColor Yellow
& "$ANDROID_HOME\platform-tools\adb.exe" install -r $APK
Write-Host "BlinkOne installed! Launching app..." -ForegroundColor Green

# 4. Launch the app
& "$ANDROID_HOME\platform-tools\adb.exe" shell monkey -p ai.blinkone.app -c android.intent.category.LAUNCHER 1
Write-Host "Done! BlinkOne is running on the emulator." -ForegroundColor Cyan
