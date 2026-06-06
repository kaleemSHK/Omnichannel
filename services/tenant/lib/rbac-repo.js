import { getPool, withTenantClient } from './db.js';
import { SYSTEM_ROLE_TEMPLATES, seedRbacCatalog } from './rbac-catalog.js';
import { inviteUserToAccount, removeUserFromAccount } from './chatwoot-platform.js';
import { fetchSeatAllowance } from './billing-client.js';

export async function ensureRbacCatalog() {
  const pool = getPool();
  if (!pool) return false;
  await seedRbacCatalog(pool);
  return true;
}

export async function seedTenantRoles(tenantId) {
  return withTenantClient(getPool(), tenantId, async (client) => {
    for (const tpl of Object.values(SYSTEM_ROLE_TEMPLATES)) {
      const { rows } = await client.query(
        `INSERT INTO tenant_roles (tenant_id, name, description, role_type, is_system, status)
         VALUES ($1,$2,$3,$4,true,'active')
         ON CONFLICT (tenant_id, name) DO UPDATE SET description = EXCLUDED.description
         RETURNING id`,
        [tenantId, tpl.name, tpl.description, tpl.roleType],
      );
      const roleId = rows[0]?.id;
      if (!roleId) continue;
      for (const perm of tpl.permissions) {
        await client.query(
          `INSERT INTO tenant_role_permissions (role_id, permission_key, granted)
           VALUES ($1,$2,true) ON CONFLICT (role_id, permission_key) DO UPDATE SET granted = true`,
          [roleId, perm],
        );
      }
      for (const page of tpl.pages) {
        await client.query(
          `INSERT INTO tenant_role_pages (role_id, page_key, visible)
           VALUES ($1,$2,true) ON CONFLICT (role_id, page_key) DO UPDATE SET visible = true`,
          [roleId, page],
        );
      }
    }
  });
}

export async function getCatalog() {
  const pool = getPool();
  if (!pool) return null;
  const [modules, pages] = await Promise.all([
    pool.query(
      `SELECT m.key, m.label, m.sort_order,
              COALESCE(json_agg(json_build_object('key', a.action_key, 'label', ra.label)
                ORDER BY a.action_key) FILTER (WHERE a.action_key IS NOT NULL), '[]') AS actions
       FROM rbac_modules m
       LEFT JOIN rbac_module_actions a ON a.module_key = m.key
       LEFT JOIN rbac_actions ra ON ra.key = a.action_key
       GROUP BY m.key, m.label, m.sort_order
       ORDER BY m.sort_order`,
    ),
    pool.query(`SELECT key, label, route, sort_order FROM rbac_pages ORDER BY sort_order`),
  ]);
  return { modules: modules.rows, pages: pages.rows };
}

export async function listRoles(tenantId) {
  return withTenantClient(getPool(), tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT r.*,
              (SELECT COUNT(*)::int FROM tenant_user_roles ur WHERE ur.role_id = r.id) AS user_count
       FROM tenant_roles r
       WHERE r.tenant_id = $1
       ORDER BY r.is_system DESC, r.name`,
      [tenantId],
    );
    return rows;
  });
}

export async function getRole(tenantId, roleId) {
  return withTenantClient(getPool(), tenantId, async (client) => {
    const { rows: roleRows } = await client.query(
      `SELECT * FROM tenant_roles WHERE tenant_id = $1 AND id = $2`,
      [tenantId, roleId],
    );
    if (!roleRows[0]) return null;
    const [perms, pages] = await Promise.all([
      client.query(`SELECT permission_key, granted FROM tenant_role_permissions WHERE role_id = $1`, [roleId]),
      client.query(`SELECT page_key, visible FROM tenant_role_pages WHERE role_id = $1`, [roleId]),
    ]);
    return {
      ...roleRows[0],
      permissions: Object.fromEntries(perms.rows.map((r) => [r.permission_key, r.granted])),
      pages: Object.fromEntries(pages.rows.map((r) => [r.page_key, r.visible])),
    };
  });
}

export async function createRole(tenantId, body) {
  return withTenantClient(getPool(), tenantId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO tenant_roles (tenant_id, name, description, role_type, status, is_system)
       VALUES ($1,$2,$3,$4,$5,false) RETURNING *`,
      [
        tenantId,
        body.name.trim(),
        body.description?.trim() || null,
        body.roleType || 'custom',
        body.status || 'active',
      ],
    );
    const role = rows[0];
    await applyRoleMatrix(client, role.id, body.permissions ?? {}, body.pages ?? {});
    return getRole(tenantId, role.id);
  });
}

export async function updateRole(tenantId, roleId, body) {
  return withTenantClient(getPool(), tenantId, async (client) => {
    const { rows } = await client.query(
      `UPDATE tenant_roles SET
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         role_type = COALESCE($5, role_type),
         status = COALESCE($6, status),
         updated_at = now()
       WHERE tenant_id = $1 AND id = $2
       RETURNING *`,
      [
        tenantId,
        roleId,
        body.name?.trim(),
        body.description?.trim(),
        body.roleType,
        body.status,
      ],
    );
    if (!rows[0]) return null;
    if (body.permissions || body.pages) {
      await applyRoleMatrix(client, roleId, body.permissions ?? {}, body.pages ?? {}, true);
    }
    return getRole(tenantId, roleId);
  });
}

async function applyRoleMatrix(client, roleId, permissions, pages, merge = false) {
  if (!merge) {
    await client.query(`DELETE FROM tenant_role_permissions WHERE role_id = $1`, [roleId]);
    await client.query(`DELETE FROM tenant_role_pages WHERE role_id = $1`, [roleId]);
  }
  for (const [key, granted] of Object.entries(permissions)) {
    if (!key.includes('.')) continue;
    await client.query(
      `INSERT INTO tenant_role_permissions (role_id, permission_key, granted)
       VALUES ($1,$2,$3) ON CONFLICT (role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted`,
      [roleId, key, Boolean(granted)],
    );
  }
  for (const [key, visible] of Object.entries(pages)) {
    await client.query(
      `INSERT INTO tenant_role_pages (role_id, page_key, visible)
       VALUES ($1,$2,$3) ON CONFLICT (role_id, page_key) DO UPDATE SET visible = EXCLUDED.visible`,
      [roleId, key, Boolean(visible)],
    );
  }
}

export async function deleteRole(tenantId, roleId) {
  return withTenantClient(getPool(), tenantId, async (client) => {
    const { rows } = await client.query(
      `DELETE FROM tenant_roles WHERE tenant_id = $1 AND id = $2 AND is_system = false RETURNING id`,
      [tenantId, roleId],
    );
    return rows[0]?.id ?? null;
  });
}

export async function listUsers(tenantId) {
  return withTenantClient(getPool(), tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT u.*,
              COALESCE(json_agg(json_build_object('id', r.id, 'name', r.name, 'roleType', r.role_type))
                FILTER (WHERE r.id IS NOT NULL), '[]') AS roles
       FROM tenant_users u
       LEFT JOIN tenant_user_roles ur ON ur.tenant_user_id = u.id
       LEFT JOIN tenant_roles r ON r.id = ur.role_id
       WHERE u.tenant_id = $1
       GROUP BY u.id
       ORDER BY u.full_name NULLS LAST, u.email`,
      [tenantId],
    );
    return rows;
  });
}

export async function countActiveSeats(tenantId) {
  return withTenantClient(getPool(), tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS c FROM tenant_users
       WHERE tenant_id = $1 AND status IN ('active', 'suspended')`,
      [tenantId],
    );
    return rows[0]?.c ?? 0;
  });
}

export async function getSeatStatus(tenantId) {
  const used = await countActiveSeats(tenantId);
  const { limit, planName } = await fetchSeatAllowance(tenantId);
  const remaining = limit != null ? Math.max(0, limit - used) : null;
  return {
    used,
    limit,
    remaining,
    planName,
    atLimit: limit != null && used >= limit,
  };
}

export async function assertSeatAvailable(tenantId, chatwootUserId) {
  const existing = await withTenantClient(getPool(), tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT id FROM tenant_users WHERE tenant_id = $1 AND chatwoot_user_id = $2`,
      [tenantId, Number(chatwootUserId)],
    );
    return rows[0]?.id ?? null;
  });
  if (existing) return;

  const seats = await getSeatStatus(tenantId);
  if (seats.atLimit) {
    throw Object.assign(
      new Error(
        `User limit reached (${seats.used}/${seats.limit} on ${seats.planName || 'current plan'}). ` +
          'Upgrade your plan or deactivate an existing user.',
      ),
      { code: 'LIMIT_EXCEEDED' },
    );
  }
}

export async function inviteUser(tenantId, body) {
  const email = body.email?.trim().toLowerCase();
  const fullName = body.fullName?.trim();
  const password = body.password?.trim();
  const linkId = body.chatwootUserId ? Number(body.chatwootUserId) : null;
  const linking = Number.isFinite(linkId);

  if (!email || !fullName) {
    throw Object.assign(new Error('fullName and email required'), { code: 'VALIDATION' });
  }
  if (!linking && (!password || password.length < 8)) {
    throw Object.assign(new Error('Password must be at least 8 characters'), { code: 'VALIDATION' });
  }

  let chatwootUserId = linking ? linkId : null;
  if (chatwootUserId != null) {
    await assertSeatAvailable(tenantId, chatwootUserId);
  } else {
    const seats = await getSeatStatus(tenantId);
    if (seats.atLimit) {
      throw Object.assign(
        new Error(
          `User limit reached (${seats.used}/${seats.limit} on ${seats.planName || 'current plan'}). ` +
            'Upgrade your plan or deactivate an existing user.',
        ),
        { code: 'LIMIT_EXCEEDED' },
      );
    }
    const cwRole = body.chatwootRole === 'administrator' ? 'administrator' : 'agent';
    const created = await inviteUserToAccount({
      accountId: tenantId,
      name: fullName,
      email,
      password,
      role: cwRole,
    });
    chatwootUserId = created.id;
  }

  return upsertUser(tenantId, {
    chatwootUserId,
    fullName,
    email,
    phone: body.phone,
    department: body.department,
    team: body.team,
    supervisorUserId: body.supervisorUserId,
    status: body.status,
    roleIds: body.roleIds,
  });
}

export async function upsertUser(tenantId, body) {
  return withTenantClient(getPool(), tenantId, async (client) => {
    const cwId = Number(body.chatwootUserId);
    if (!Number.isFinite(cwId)) throw Object.assign(new Error('chatwootUserId required'), { code: 'VALIDATION' });

    const { rows } = await client.query(
      `INSERT INTO tenant_users (
         tenant_id, chatwoot_user_id, full_name, email, phone,
         department, team, supervisor_user_id, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (tenant_id, chatwoot_user_id) DO UPDATE SET
         full_name = COALESCE(EXCLUDED.full_name, tenant_users.full_name),
         email = COALESCE(EXCLUDED.email, tenant_users.email),
         phone = COALESCE(EXCLUDED.phone, tenant_users.phone),
         department = COALESCE(EXCLUDED.department, tenant_users.department),
         team = COALESCE(EXCLUDED.team, tenant_users.team),
         supervisor_user_id = COALESCE(EXCLUDED.supervisor_user_id, tenant_users.supervisor_user_id),
         status = COALESCE(EXCLUDED.status, tenant_users.status),
         updated_at = now()
       RETURNING *`,
      [
        tenantId,
        cwId,
        body.fullName?.trim() || null,
        body.email?.trim() || null,
        body.phone?.trim() || null,
        body.department?.trim() || null,
        body.team?.trim() || null,
        body.supervisorUserId ? Number(body.supervisorUserId) : null,
        body.status || 'active',
      ],
    );
    const user = rows[0];

    if (Array.isArray(body.roleIds)) {
      await client.query(`DELETE FROM tenant_user_roles WHERE tenant_user_id = $1`, [user.id]);
      for (const roleId of body.roleIds) {
        await client.query(
          `INSERT INTO tenant_user_roles (tenant_user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [user.id, roleId],
        );
      }
    }
    return user;
  });
}

export async function deleteUser(tenantId, tenantUserId, actorChatwootUserId) {
  return withTenantClient(getPool(), tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM tenant_users WHERE tenant_id = $1 AND id = $2`,
      [tenantId, tenantUserId],
    );
    const user = rows[0];
    if (!user) return null;

    if (actorChatwootUserId && Number(actorChatwootUserId) === Number(user.chatwoot_user_id)) {
      throw Object.assign(new Error('You cannot delete your own account'), { code: 'VALIDATION' });
    }

    const { rows: adminCountRows } = await client.query(
      `SELECT COUNT(DISTINCT u.id)::int AS c
       FROM tenant_users u
       JOIN tenant_user_roles ur ON ur.tenant_user_id = u.id
       JOIN tenant_roles r ON r.id = ur.role_id
       WHERE u.tenant_id = $1 AND r.role_type = 'tenant_admin' AND u.status != 'inactive'`,
      [tenantId],
    );
    const { rows: targetAdminRows } = await client.query(
      `SELECT 1 FROM tenant_user_roles ur
       JOIN tenant_roles r ON r.id = ur.role_id
       WHERE ur.tenant_user_id = $1 AND r.role_type = 'tenant_admin'`,
      [user.id],
    );
    if (targetAdminRows.length && (adminCountRows[0]?.c ?? 0) <= 1) {
      throw Object.assign(new Error('Cannot delete the last Tenant Admin'), { code: 'VALIDATION' });
    }

    try {
      await removeUserFromAccount({ accountId: tenantId, userId: user.chatwoot_user_id });
    } catch (e) {
      console.warn('[rbac] Chatwoot account user removal failed:', e.message);
    }

    await client.query(`DELETE FROM tenant_users WHERE id = $1`, [user.id]);
    return { id: user.id, chatwootUserId: user.chatwoot_user_id };
  });
}

export async function getUserRoleIds(tenantId, chatwootUserId) {
  return withTenantClient(getPool(), tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT r.id, r.role_type, r.name
       FROM tenant_users u
       JOIN tenant_user_roles ur ON ur.tenant_user_id = u.id
       JOIN tenant_roles r ON r.id = ur.role_id
       WHERE u.tenant_id = $1 AND u.chatwoot_user_id = $2 AND r.status = 'active'`,
      [tenantId, Number(chatwootUserId)],
    );
    return rows;
  });
}

export async function getRolePermissionsUnion(tenantId, roleIds) {
  if (!roleIds?.length) return { permissions: new Set(), pages: new Set() };
  return withTenantClient(getPool(), tenantId, async (client) => {
    const { rows: permRows } = await client.query(
      `SELECT DISTINCT permission_key FROM tenant_role_permissions
       WHERE role_id = ANY($1::uuid[]) AND granted = true`,
      [roleIds],
    );
    const { rows: pageRows } = await client.query(
      `SELECT DISTINCT page_key FROM tenant_role_pages
       WHERE role_id = ANY($1::uuid[]) AND visible = true`,
      [roleIds],
    );
    return {
      permissions: new Set(permRows.map((r) => r.permission_key)),
      pages: new Set(pageRows.map((r) => r.page_key)),
    };
  });
}

/** Seed roles and assign Tenant Admin to the provisioned owner. */
export async function assignTenantOwnerRbac(tenantId, { chatwootUserId, email, fullName }) {
  await seedTenantRoles(tenantId);
  const roles = await listRoles(tenantId);
  const tenantAdmin = roles.find((r) => r.role_type === 'tenant_admin');
  if (!tenantAdmin) {
    throw new Error('tenant_admin role not found after seed');
  }
  return upsertUser(tenantId, {
    chatwootUserId,
    email,
    fullName,
    status: 'active',
    roleIds: [tenantAdmin.id],
  });
}
