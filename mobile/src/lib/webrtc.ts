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
    const { RTCPeerConnection, RTCSessionDescription } = require('react-native-webrtc');
    (globalThis as Record<string, unknown>).RTCPeerConnection = RTCPeerConnection;
    (globalThis as Record<string, unknown>).RTCSessionDescription = RTCSessionDescription;
    available = true;
    return true;
  } catch {
    console.warn(
      '[WebRTC] Failed to load native module. Install the BlinkOne dev client APK (EAS build).',
    );
    available = false;
    return false;
  }
}

export function isWebRtcAvailable(): boolean {
  if (available === null) return installWebRtcGlobals();
  return available;
}
