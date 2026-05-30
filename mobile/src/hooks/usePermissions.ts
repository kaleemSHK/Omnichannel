import {
  requestMicrophonePermission,
  requestNotificationPermission,
} from '@/lib/permissions';

export function usePermissions() {
  return {
    requestMic: requestMicrophonePermission,
    requestNotifications: requestNotificationPermission,
  };
}
