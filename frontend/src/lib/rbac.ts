import type { BlinkoneUser } from '@/types';
import { normalizeRole, type UserRole } from '@/lib/roles';

export type { UserRole };

export const ROLE_PERMISSIONS = {
  routes: {
    '/conversations': ['agent', 'supervisor', 'admin', 'platform_admin'],
    '/calling': ['agent', 'supervisor', 'admin', 'platform_admin'],
    '/calling/wallboard': ['supervisor', 'admin', 'platform_admin'],
    '/calling/ivr': ['admin', 'platform_admin'],
    '/contacts': ['agent', 'supervisor', 'admin', 'platform_admin'],
    '/sla': ['supervisor', 'admin', 'platform_admin'],
    '/escalation': ['supervisor', 'admin', 'platform_admin'],
    '/ai': ['agent', 'supervisor', 'admin', 'platform_admin'],
    '/billing': ['admin', 'platform_admin'],
    '/platform': ['platform_admin'],
    '/tickets': ['agent', 'supervisor', 'admin', 'platform_admin'],
    '/reports': ['supervisor', 'admin', 'platform_admin'],
    '/settings': ['agent', 'supervisor', 'admin', 'platform_admin'],
  } as Record<string, UserRole[]>,

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

export function can(
  role: UserRole | string | undefined,
  feature: keyof typeof ROLE_PERMISSIONS.features,
): boolean {
  const normalized = normalizeRole(role);
  return (ROLE_PERMISSIONS.features[feature] as UserRole[]).includes(normalized);
}

export function canAccessRoute(role: UserRole | string | undefined, pathname: string): boolean {
  const normalized = normalizeRole(role);
  const match = Object.entries(ROLE_PERMISSIONS.routes)
    .filter(([route]) => pathname.startsWith(route))
    .sort((a, b) => b[0].length - a[0].length)[0];
  if (!match) return true;
  return (match[1] as UserRole[]).includes(normalized);
}

export function defaultRouteForRole(role: UserRole | string): string {
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
