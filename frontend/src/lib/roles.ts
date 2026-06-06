import type { BlinkoneUser } from '@/types';

export type UserRole = BlinkoneUser['role'];

const ROLE_RANK: Record<UserRole, number> = {
  agent: 1,
  supervisor: 2,
  admin: 3,
  platform_admin: 4,
};

/** Map Chatwoot / gateway role strings to BlinkOne roles. */
const ROLE_ALIASES: Record<string, UserRole> = {
  agent: 'agent',
  supervisor: 'supervisor',
  administrator: 'admin',
  admin: 'admin',
  platform_admin: 'platform_admin',
  super_admin: 'platform_admin',
  superadmin: 'platform_admin',
};

export function normalizeRole(raw: string | undefined | null): UserRole {
  if (!raw) return 'agent';
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_');
  return ROLE_ALIASES[key] ?? 'agent';
}

function decodeJwtPayload(token: string): { roles?: string[] } | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as { roles?: string[] };
  } catch {
    return null;
  }
}

function pickHighestRole(roles: UserRole[]): UserRole {
  return roles.reduce(
    (best, r) => (ROLE_RANK[r] > ROLE_RANK[best] ? r : best),
    'agent' as UserRole,
  );
}

/** Resolve the effective BlinkOne role from Chatwoot sign-in + gateway JWT. */
export function resolveRoleFromAuth(
  chatwootRole: string | undefined,
  gatewayJwt?: string,
  email?: string,
  chatwootUserType?: string,
): UserRole {
  const candidates: UserRole[] = [normalizeRole(chatwootRole)];
  if (String(chatwootUserType ?? '').trim() === 'SuperAdmin') {
    candidates.push('platform_admin');
  }

  if (gatewayJwt) {
    const payload = decodeJwtPayload(gatewayJwt);
    if (payload?.roles?.length) {
      candidates.push(...payload.roles.map(r => normalizeRole(r)));
    }
  }

  const platformEmails = (
    process.env.NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS ?? 'admin@blinkone.ai,admin@labbik.om'
  )
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  if (email && platformEmails.includes(email.toLowerCase())) {
    candidates.push('platform_admin');
  }

  return pickHighestRole(candidates);
}
