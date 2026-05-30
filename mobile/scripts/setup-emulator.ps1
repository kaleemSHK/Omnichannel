# Run this AFTER the system image download completes
$ANDROID_HOME = "C:\Android\Sdk"
$SYSIMG_ZIP = "C:\Android\Sdk\system-images-download\x86_64-35_r09.zip"
$SYSIMG_DEST = "C:\Android\Sdk\system-images\android-35\google_apis\x86_64"
$AVD_NAME = "BlinkOne_Pixel9"
$APK = "E:\BlinkOne\mobile\android\app\build\outputs\apk\release\app-release.apk"

Write-Host "Step 1: Extracting system image..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $SYSIMG_DEST | Out-Null
Expand-Archive -Path $SYSIMG_ZIP -DestinationPath "C:\Android\Sdk\system-images\android-35\google_apis" -Force
# The zip extracts to x86_64/ subfolder automatically
Write-Host "System image extracted." -ForegroundColor Green

Write-Host "Step 2: Writing source.properties..." -ForegroundColor Cyan
$props = @"
Pkg.Revision=9
AndroidVersion.ApiLevel=35
Pkg.Desc=Google APIs Intel x86_64 Atom System Image
Pkg.UserSrc=false
SystemImage.TagId=google_apis
SystemImage.TagDisplay=Google APIs
Abi=x86_64
"@
Set-Content "$SYSIMG_DEST\source.properties" $props

Write-Host "Step 3: Creating AVD..." -ForegroundColor Cyan
& "$ANDROID_HOME\cmdline-tools\latest\bin\avdmanager.bat" create avd `
    --name $AVD_NAME `
    --package "system-images;android-35;google_apis;x86_64" `
    --device "pixel_9" `
    --force
Write-Host "AVD created." -ForegroundColor Green

Write-Host "Step 4: Launching emulator..." -ForegroundColor Cyan
$env:ANDROID_HOME = $ANDROID_HOME
$env:ANDROID_SDK_ROOT = $ANDROID_HOME
Start-Process "$ANDROID_HOME\emulator\emulator.exe" `
    -ArgumentList "-avd $AVD_NAME -no-snapshot-load -gpu auto -memory 3072"

Write-Host "Waiting for emulator to boot (~90 seconds)..." -ForegroundColor Yellow
& "$ANDROID_HOME\platform-tools\adb.exe" wait-for-device
do {
    Start-Sleep -Seconds 5
    $boot = & "$ANDROID_HOME\platform-tools\adb.exe" shell getprop sys.boot_completed 2>&1
} while ($boot.Trim() -ne "1")

Write-Host "Step 5: Installing BlinkOne APK..." -ForegroundColor Cyan
& "$ANDROID_HOME\platform-tools\adb.exe" install -r $APK
Write-Host "Done! BlinkOne is running." -ForegroundColor Green
& "$ANDROID_HOME\platform-tools\adb.exe" shell monkey -p ai.blinkone.app -c android.intent.category.LAUNCHER 1
