import { NativeModules } from 'react-native';

/** Lazy-load react-native-webrtc so route discovery does not crash without the dev client. */
let available: boolean | null = null;

export function installWebRtcGlobals(): boolean {
  if (available === true) return true;
  if (available === false) return false;

  if (!NativeModules.WebRTCModule) {
    console.warn(
      '[WebRTC] Native module not found. Install the BlinkOne dev client APK (EAS build), not Expo Go.',
    );
    available = false;
    return false;
  }

  try {
    const rnWebRTC = require('react-native-webrtc') as {
      registerGlobals: () => void;
      mediaDevices: { getUserMedia: (c: unknown) => Promise<unknown> };
    };

    const g = globalThis as typeof globalThis & {
      navigator?: { mediaDevices?: { getUserMedia?: unknown } };
    };
    if (!g.navigator || typeof g.navigator !== 'object') {
      (g as { navigator: object }).navigator = {};
    }

    // JsSIP uses navigator.mediaDevices.getUserMedia — not global.getUserMedia alone.
    rnWebRTC.registerGlobals();

    if (!g.navigator?.mediaDevices?.getUserMedia) {
      console.warn('[WebRTC] registerGlobals did not set navigator.mediaDevices.getUserMedia');
      available = false;
      return false;
    }

    available = true;
    return true;
  } catch (e) {
    console.warn(
      '[WebRTC] Failed to load native module.',
      e instanceof Error ? e.message : e,
    );
    available = false;
    return false;
  }
}

export function isWebRtcAvailable(): boolean {
  if (available === null) return installWebRtcGlobals();
  return available;
}
