import type { BlinkoneUser } from '@/types';
import { usePermissionsStore } from '@/lib/permissions';

export type UserRole = BlinkoneUser['role'];

const FEATURE_TO_PERMISSION: Record<string, string> = {
  sendPrivateNote: 'chat.send',
  assignConversation: 'tickets.assign',
  resolveConversation: 'tickets.close',
  viewReports: 'reports.view',
  manageBilling: 'billing.edit',
  manageWebhooks: 'integrations.configure',
  manageInboxes: 'settings.edit',
  manageTeam: 'users.edit',
  supervisorListen: 'calling.monitor_call',
  supervisorWhisper: 'calling.monitor_call',
  supervisorBarge: 'calling.monitor_call',
  viewWallboard: 'queues.view',
  manageEscalation: 'workflows.edit',
  manageSLA: 'settings.edit',
  manageIVR: 'ivr.edit',
  impersonateTenant: 'settings.view',
};

export function normalizeRole(role: string | undefined): UserRole {
  if (role === 'platform_admin' || role === 'admin' || role === 'supervisor' || role === 'agent') {
    return role;
  }
  return 'agent';
}

export const ROLE_PERMISSIONS = {
  features: {
    sendPrivateNote: ['agent', 'supervisor', 'admin', 'platform_admin'],
    assignConversation: ['supervisor', 'admin', 'platform_admin'],
    resolveConversation: ['agent', 'supervisor', 'admin', 'platform_admin'],
    viewReports: ['supervisor', 'admin', 'platform_admin'],
    manageBilling: ['admin', 'platform_admin'],
    manageWebhooks: ['admin', 'platform_admin'],
    manageInboxes: ['admin', 'platform_admin'],
    manageTeam: ['admin', 'platform_admin'],
    supervisorListen: ['supervisor', 'admin', 'platform_admin'],
    supervisorWhisper: ['supervisor', 'admin', 'platform_admin'],
    supervisorBarge: ['supervisor', 'admin', 'platform_admin'],
    viewWallboard: ['supervisor', 'admin', 'platform_admin'],
    manageEscalation: ['supervisor', 'admin', 'platform_admin'],
    manageSLA: ['supervisor', 'admin', 'platform_admin'],
    manageIVR: ['admin', 'platform_admin'],
    impersonateTenant: ['platform_admin'],
  } as Record<string, UserRole[]>,
} as const;

export function can(role: UserRole | string | undefined, feature: keyof typeof ROLE_PERMISSIONS.features): boolean {
  const dynamicKey = FEATURE_TO_PERMISSION[feature];
  const perms = usePermissionsStore.getState().permissions;
  if (perms.length && dynamicKey) {
    return perms.includes(dynamicKey);
  }
  const normalized = normalizeRole(role);
  return (ROLE_PERMISSIONS.features[feature] as UserRole[]).includes(normalized);
}

export function canPage(pageKey: string): boolean {
  return usePermissionsStore.getState().hasPageKey(pageKey);
}
