import type { BlinkoneUser } from '@/types';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { usePermissionsStore } from '@/lib/store/permissions';
import { FEATURE_TO_PERMISSION } from '@/lib/rbac-dynamic';

export type { UserRole };

export const ROLE_PERMISSIONS = {
  routes: {
    '/conversations': ['agent', 'supervisor', 'admin', 'platform_admin'],
    '/calling': ['agent', 'supervisor', 'admin', 'platform_admin'],
    '/calling/history': ['agent', 'supervisor', 'admin', 'platform_admin'],
    '/calling/wallboard': ['supervisor', 'admin', 'platform_admin'],
    '/calling/ivr': ['admin', 'platform_admin'],
    '/contacts': ['agent', 'supervisor', 'admin', 'platform_admin'],
    '/ai': ['agent', 'supervisor', 'admin', 'platform_admin'],
    '/sla': ['supervisor', 'admin', 'platform_admin'],
    '/escalation': ['supervisor', 'admin', 'platform_admin'],
    '/billing': ['admin', 'platform_admin'],
    '/platform': ['platform_admin'],
    '/tickets': ['agent', 'supervisor', 'admin', 'platform_admin'],
    '/reports': ['supervisor', 'admin', 'platform_admin'],
    '/settings': ['agent', 'supervisor', 'admin', 'platform_admin'],
  } as Record<string, UserRole[]>,

  features: {
    sendPrivateNote: ['agent', 'supervisor', 'admin', 'platform_admin'],
    assignConversation: ['supervisor', 'admin', 'platform_admin'],
    assignTeam: ['agent', 'supervisor', 'admin', 'platform_admin'],
    manageAgentScripts: ['supervisor', 'admin', 'platform_admin'],
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
    viewAgentAssist: ['agent', 'supervisor', 'admin', 'platform_admin'],
  } as Record<string, UserRole[]>,
} as const;

export function can(
  role: UserRole | string | undefined,
  feature: keyof typeof ROLE_PERMISSIONS.features,
): boolean {
  const dynamicKey = FEATURE_TO_PERMISSION[feature];
  const dynamic = usePermissionsStore.getState();
  const normalized = normalizeRole(role);
  const roleAllowed = (ROLE_PERMISSIONS.features[feature] as UserRole[]).includes(normalized);

  if (dynamic.effective?.permissions?.length && dynamicKey) {
    if (dynamic.hasPermission(dynamicKey)) return true;
    // Chatwoot administrator before RBAC row exists, or stale JWT permissions
    return roleAllowed;
  }
  return roleAllowed;
}

export function canPermission(permissionKey: string, role?: UserRole | string): boolean {
  const dynamic = usePermissionsStore.getState();
  if (dynamic.effective?.permissions?.length) {
    if (dynamic.hasPermission(permissionKey)) return true;
  } else {
    return false;
  }

  const normalized = normalizeRole(role);
  if (normalized === 'admin' || normalized === 'platform_admin') {
    if (permissionKey.startsWith('roles.') || permissionKey.startsWith('users.')) return true;
  }
  return false;
}

export function canAccessRoute(role: UserRole | string | undefined, pathname: string): boolean {
  // Platform admin panel is cross-tenant; JWT platform_admin role is required (not RBAC page.platform).
  if (pathname.startsWith('/platform')) {
    return normalizeRole(role) === 'platform_admin';
  }
  const dynamic = usePermissionsStore.getState();
  if (dynamic.effective?.pages?.length) {
    return dynamic.canAccessPath(pathname);
  }
  const normalized = normalizeRole(role);
  const match = Object.entries(ROLE_PERMISSIONS.routes)
    .filter(([route]) => pathname.startsWith(route))
    .sort((a, b) => b[0].length - a[0].length)[0];
  if (!match) return true;
  return (match[1] as UserRole[]).includes(normalized);
}

export function defaultRouteForRole(role: UserRole | string): string {
  const dynamic = usePermissionsStore.getState();
  if (dynamic.effective?.pages?.length) {
    const order = [
      '/conversations',
      '/calling',
      '/contacts',
      '/tickets',
      '/reports',
      '/settings',
    ];
    for (const route of order) {
      if (dynamic.canAccessPath(route)) return route;
    }
  }
  const normalized = normalizeRole(role);
  if (normalized === 'platform_admin') return '/platform';
  return '/conversations';
}

export const ROLE_META: Record<UserRole, { label: string; color: string }> = {
  agent: { label: 'Agent', color: 'bg-blue-100 text-blue-700' },
  supervisor: { label: 'Supervisor', color: 'bg-purple-100 text-purple-700' },
  admin: { label: 'Admin', color: 'bg-green-100 text-green-700' },
  platform_admin: { label: 'Platform Admin', color: 'bg-red-100 text-red-700' },
};
