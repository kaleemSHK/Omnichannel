# BlinkOne Mobile — bare React Native (no Expo)

Android app with **react-native-webrtc** + JsSIP. Build with Gradle; run Metro separately.

## Prerequisites

1. Node.js 20+
2. Android Studio + SDK (API 36, build-tools 35)
3. JDK 17
4. Copy `.env.example` → `.env` and set your server URLs

## Install

```powershell
cd E:\BlinkOne\mobile
npm install --legacy-peer-deps
```

## Run on device/emulator

Terminal 1 — Metro:

```powershell
npm start
```

Terminal 2 — install debug APK:

```powershell
npm run android
```

Or build **debug** APK (requires Metro when opening the app):

```powershell
.\build_apk.ps1
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

## Incoming-call push (FCM)

Server push is enabled on production (`PUSH_CALLS_ENABLED=1`, `FCM_SERVER_KEY` set).

**Mobile setup (done in repo):**

1. Firebase → Android app `ai.blinkone.app` → `android/app/google-services.json`
2. `@react-native-firebase/app` + `@react-native-firebase/messaging` (installed)
3. Rebuild APK — app registers a **real FCM token** on login

```powershell
cd E:\BlinkOne\mobile
npm install --legacy-peer-deps
.\build_apk_release.ps1
```

Install `android/app/build/outputs/apk/release/app-release.apk`, log in as agent, allow notifications. Token syncs to gateway via `POST /api/devices/register`.

Verify on server: device row should **not** start with `dev-`.

## Post-call transcription

Set `AUTO_STT_ON_RECORDING=1` on the recording service (via root `.env`) to queue Whisper STT jobs when call audio lands in MinIO.

### Customer Call Support (mobile)

After code changes for queue / SIP dial, rebuild the release APK:

```powershell
cd mobile
.\build_apk_release.ps1
adb install -r android\app\build\outputs\apk\release\app-release.apk
```

Requires `.env` from `.env.production.example` (`SIP_WSS`, `AGENT_DESK_EXT=blinkone`, `GATEWAY_URL=https://app.blinksone.com`).

## Production APK (no Metro — for real devices)

Copy production URLs, bundle JS inside the APK, install standalone:

```powershell
.\build_apk_release.ps1
```

APK output: `android/app/build/outputs/apk/release/app-release.apk`

Uses `.env.production.example` → `.env` (`https://app.blinksone.com`, `wss://sip.blinksone.com`, etc.).

## Environment variables

Configured via `react-native-config` in `.env`:

| Variable | Purpose |
|----------|---------|
| `CHATWOOT_URL` | Chatwoot API base |
| `GATEWAY_URL` | BlinkOne gateway |
| `WS_URL` | Action Cable WebSocket |
| `SIP_WSS` | Kamailio WSS URI |
| `SIP_PASS` | Agent SIP password |

After changing `.env`, rebuild the Android app.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Cannot reach API | Check `.env` URLs; rebuild APK |
| Red screen “Unable to load script” | You installed **debug** APK without Metro — use `.\build_apk_release.ps1` instead |
| Metro not connecting | `adb reverse tcp:8081 tcp:8081` for USB device |
| SIP / calls fail | Verify `SIP_WSS` and Kamailio WSS on server |
| Crash right after agent login | Fixed: Chatwoot returns `data.payload` not `data[]` — pull latest mobile + reload Metro |
| Mobile call, browser does not ring | Log in on **web** first (SIP user `blinkone`). On mobile dial pad enter **`blinkone`** (not a phone number). Mobile registers as your agent id so it does not steal the browser registration. |
| Contacts empty | Fixed: Chatwoot uses `payload` not `data` — reload Metro; contacts load on open |
| User queue / unified calling | See `docs/blinkone/UNIFIED_CALLING.md`; customer **Call Support** uses ACD when server deployed |
