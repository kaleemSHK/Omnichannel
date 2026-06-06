import { RBAC_PAGES } from './rbac-catalog.js';
import * as repo from './rbac-repo.js';

const CHATWOOT_ROLE_MAP = {
  administrator: 'tenant_admin',
  admin: 'tenant_admin',
  supervisor: 'supervisor',
  agent: 'agent',
};

/** Map legacy feature keys → dynamic permission keys */
const FEATURE_TO_PERMISSION = {
  sendPrivateNote: 'chat.send',
  assignConversation: 'tickets.assign',
  assignTeam: 'teams.edit',
  manageAgentScripts: 'settings.edit',
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
  viewAgentAssist: 'ai.use',
};

/**
 * Resolve effective permissions for a user at login.
 * Platform admins get full catalog without DB lookup.
 */
export async function resolveEffectiveAccess({
  tenantId,
  chatwootUserId,
  chatwootRole,
  isPlatformAdmin,
  email,
  name,
}) {
  if (isPlatformAdmin) {
    const catalog = await repo.getCatalog();
    const permissions = [];
    for (const m of catalog?.modules ?? []) {
      for (const a of m.actions ?? []) {
        if (a.key) permissions.push(`${m.key}.${a.key}`);
      }
    }
    return {
      permissions,
      pages: RBAC_PAGES.map((p) => p.key),
      roles: [{ name: 'Platform Admin', roleType: 'platform_admin' }],
      source: 'platform_admin',
    };
  }

  await repo.ensureRbacCatalog();
  let roleRows = await repo.getUserRoleIds(tenantId, chatwootUserId);

  if (!roleRows.length) {
    await repo.seedTenantRoles(tenantId);
    const mapped = CHATWOOT_ROLE_MAP[String(chatwootRole || '').toLowerCase()] || 'agent';
    const allRoles = await repo.listRoles(tenantId);
    const match = allRoles.find((r) => r.role_type === mapped);
    if (match) {
      await repo.upsertUser(tenantId, {
        chatwootUserId,
        fullName: name,
        email,
        roleIds: [match.id],
      });
      roleRows = await repo.getUserRoleIds(tenantId, chatwootUserId);
    }
  }

  const roleIds = roleRows.map((r) => r.id);
  const { permissions, pages } = await repo.getRolePermissionsUnion(tenantId, roleIds);

  return {
    permissions: [...permissions],
    pages: [...pages],
    roles: roleRows.map((r) => ({ id: r.id, name: r.name, roleType: r.role_type })),
    source: roleRows.length ? 'database' : 'fallback',
  };
}

export function hasPermission(effective, permissionKey) {
  if (!effective?.permissions?.length) return false;
  return effective.permissions.includes(permissionKey);
}

export function canAccessPage(effective, pathname) {
  if (!effective?.pages?.length) return true;
  const catalog = RBAC_PAGES.filter((p) => effective.pages.includes(p.key));
  if (!catalog.length) return true;
  const match = catalog
    .filter((p) => pathname.startsWith(p.route))
    .sort((a, b) => b.route.length - a.route.length)[0];
  if (!match) return true;
  return effective.pages.includes(match.key);
}

export function legacyFeatureAllowed(effective, featureKey) {
  const perm = FEATURE_TO_PERMISSION[featureKey];
  if (!perm) return false;
  return hasPermission(effective, perm);
}

export { FEATURE_TO_PERMISSION };
