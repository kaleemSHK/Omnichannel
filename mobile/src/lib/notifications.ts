import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { useAuthStore } from '@/store/auth';

const DEVICE_PUSH_KEY = 'blinkone_push_device_id';

export type PushPayload = Record<string, unknown>;

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
  const authStatus = await messaging().requestPermission();
  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
}

async function resolveFcmToken(): Promise<string | null> {
  try {
    const token = await messaging().getToken();
    return token || null;
  } catch (err) {
    console.warn('[push] FCM getToken failed', err);
    return null;
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) {
    console.warn('[push] notification permission denied');
    return null;
  }

  const fcm = await resolveFcmToken();
  if (fcm) {
    await AsyncStorage.setItem(DEVICE_PUSH_KEY, fcm);
    console.info('[push] FCM token registered');
    return fcm;
  }

  console.warn('[push] no FCM token — check google-services.json and Firebase app setup');
  return null;
}

function handlePushNavigation(data: PushPayload | undefined) {
  if (!data) return;
  const { navigate } = require('@/navigation/navigationRef') as typeof import('@/navigation/navigationRef');
  if (isIncomingCallPush(data)) {
    navigate('CallActive');
    return;
  }
  if (data.conversationId) {
    navigate('Agent', {
      screen: 'ConversationDetail',
      params: { id: String(data.conversationId) },
    });
  }
}

export function addNotificationListeners(handlers: {
  onReceived?: (data: PushPayload) => void;
  onResponse?: (data: PushPayload) => void;
}): () => void {
  const unsubToken = messaging().onTokenRefresh((token) => {
    void AsyncStorage.setItem(DEVICE_PUSH_KEY, token);
    useAuthStore.getState().setPushToken(token);
  });

  const unsubForeground = messaging().onMessage(async (remoteMessage) => {
    const data = remoteMessage?.data ?? {};
    handlers.onReceived?.(data);
    if (isIncomingCallPush(data)) {
      handlePushNavigation(data);
    }
  });

  const unsubOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
    const data = remoteMessage?.data ?? {};
    handlers.onResponse?.(data);
    handlePushNavigation(data);
  });

  void messaging().getInitialNotification().then((remoteMessage) => {
    const data = remoteMessage?.data;
    if (!data) return;
    handlers.onResponse?.(data);
    handlePushNavigation(data);
  });

  return () => {
    unsubToken();
    unsubForeground();
    unsubOpened();
  };
}

export function isIncomingCallPush(data: PushPayload | undefined): boolean {
  return data?.type === 'incoming_call' && typeof data.callSessionId === 'string';
}

export function isRealFcmToken(token: string | null | undefined): boolean {
  return !!token && !token.startsWith('dev-');
}
