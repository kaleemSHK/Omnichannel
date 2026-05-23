import { getTenantContext } from '@blinkone/tenant-context';

export type Role = 'admin' | 'supervisor' | 'agent' | 'viewer';
export type PlatformRole = 'platform_admin' | 'platform_support' | 'platform_billing';

const PERMISSIONS: Record<string, Role[]> = {
  'billing:read': ['admin', 'supervisor', 'viewer'],
  'billing:write': ['admin'],
  'routing:read': ['admin', 'supervisor', 'agent', 'viewer'],
  'routing:write': ['admin', 'supervisor'],
  'sla:read': ['admin', 'supervisor', 'agent', 'viewer'],
  'sla:write': ['admin', 'supervisor'],
  'escalation:read': ['admin', 'supervisor', 'viewer'],
  'escalation:write': ['admin', 'supervisor'],
  'ai:read': ['admin', 'supervisor', 'agent', 'viewer'],
  'ai:write': ['admin', 'supervisor', 'agent'],
  'integration:read': ['admin', 'supervisor'],
  'integration:write': ['admin'],
  'branding:read': ['admin', 'supervisor', 'agent', 'viewer'],
  'branding:write': ['admin'],
  'audit:read': ['admin', 'supervisor'],
  'calls:read': ['admin', 'supervisor', 'agent', 'viewer'],
  'calls:write': ['admin', 'supervisor', 'agent'],
  'sso:read': ['admin'],
  'sso:write': ['admin'],
};

export function isPlatformRole(roles: string[]): boolean {
  return roles.some((r) =>
    ['platform_admin', 'platform_support', 'platform_billing'].includes(r),
  );
}

export function hasPermission(roles: string[], permission: string): boolean {
  if (isPlatformRole(roles)) return true;
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return roles.some((r) => allowed.includes(r as Role));
}

export function requirePermission(permission: string): void {
  const { roles } = getTenantContext();
  if (!hasPermission(roles, permission)) {
    throw new Error(`Forbidden: missing permission ${permission}`);
  }
}

/** NestJS / Fastify route guard helper */
export function RequiresPermission(permission: string) {
  return function permissionGuard(): void {
    requirePermission(permission);
  };
}
