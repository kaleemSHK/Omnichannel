import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';

const DEVICE_PUSH_KEY = 'blinkone_push_device_id';

export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  const result = await request(PERMISSIONS.IOS.MICROPHONE);
  return result === RESULTS.GRANTED;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }
  const result = await request(PERMISSIONS.IOS.NOTIFICATIONS);
  return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
}

/** Returns a stable device token; swap for FCM/APNs when push provider is wired. */
export async function registerForPushNotifications(): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) return null;
  let token = await AsyncStorage.getItem(DEVICE_PUSH_KEY);
  if (!token) {
    token = `dev-${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_PUSH_KEY, token);
  }
  return token;
}

export function addNotificationListeners(_handlers: {
  onReceived?: () => void;
  onResponse?: (data: Record<string, unknown>) => void;
}): () => void {
  return () => undefined;
}
