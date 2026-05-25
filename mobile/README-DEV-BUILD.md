# BlinkOne Mobile — Android development build

Expo Go cannot load `react-native-webrtc`. Use a **development build** (custom APK with `expo-dev-client`).

## Prerequisites

1. [Expo account](https://expo.dev/signup) (free)
2. `mobile/.env` — set your laptop WiFi IP (`192.168.1.x`) before building
3. Phone and laptop on the **same WiFi**

## Option A — EAS cloud build (recommended, no Android Studio)

```powershell
cd E:\BlinkOne\mobile
npm install --legacy-peer-deps
npx eas-cli login
npx eas build --profile development --platform android
```

When the build finishes, open the link, download the **APK**, install on your phone.

Start the dev server:

```powershell
npx expo start --dev-client
```

Open the installed **BlinkOne** app (not Expo Go) and connect to `exp://192.168.1.9:8081`.

## Option B — Local build (requires Android Studio + SDK)

Install [Android Studio](https://developer.android.com/studio) and set `ANDROID_HOME`.

```powershell
cd E:\BlinkOne\mobile
npx expo prebuild --platform android --clean
npx expo run:android --device
```

## After installing the dev APK

1. Start Docker (Chatwoot `:3000`, nginx `:80`, Asterisk WSS `:8089`)
2. Run `npx expo start --dev-client` on the laptop
3. Open **BlinkOne** on the phone — it loads JS from your dev server
4. Allow microphone permission when calling

## Rebuild required when

- Changing `app.json` plugins
- Upgrading native modules (`react-native-webrtc`, etc.)
- Changing `EXPO_PUBLIC_*` in `.env` (rebuild APK, then restart dev server)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Cannot reach API | Update `mobile/.env` IP; rebuild APK |
| Metro not connecting | Same WiFi; use `npx expo start --dev-client --lan` |
| SIP / calls fail | Check `EXPO_PUBLIC_SIP_WSS` and Asterisk on `:8089` |
