import { requestRecordingPermissionsAsync } from 'expo-audio';
import * as Notifications from 'expo-notifications';

export function usePermissions() {
  async function requestMic(): Promise<boolean> {
    const { granted } = await requestRecordingPermissionsAsync();
    return granted;
  }

  async function requestNotifications(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  return { requestMic, requestNotifications };
}
