import { randomUUID } from 'node:crypto';
import { getPool, tenantQuery, withTenantClient } from './db.js';

function tenantRow(r) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    ownerEmail: r.owner_email,
    primaryContactPhone: r.primary_contact_phone,
    billingPlanId: r.billing_plan_id,
    chatwootAccountId: Number(r.chatwoot_account_id),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Platform list — bypasses RLS via superuser connection (no tenant context). */
export async function listTenantsPlatform() {
  const { rows } = await getPool().query(
    'SELECT * FROM tenants ORDER BY created_at DESC LIMIT 500',
  );
  return rows.map(tenantRow);
}

export async function getTenantPlatform(id) {
  const { rows } = await getPool().query('SELECT * FROM tenants WHERE id = $1', [id]);
  return rows.length ? tenantRow(rows[0]) : null;
}

export async function getTenantBySlug(slug) {
  const { rows } = await getPool().query('SELECT * FROM tenants WHERE slug = $1', [slug]);
  return rows.length ? tenantRow(rows[0]) : null;
}

export async function insertTenant(row) {
  const p = getPool();
  await p.query(
    `INSERT INTO tenants (id, name, slug, status, owner_email, primary_contact_phone, billing_plan_id, chatwoot_account_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      row.id,
      row.name,
      row.slug,
      row.status,
      row.ownerEmail,
      row.primaryContactPhone ?? null,
      row.billingPlanId ?? null,
      row.chatwootAccountId,
    ],
  );
  return getTenantPlatform(row.id);
}

export async function upsertFeatures(tenantId, features) {
  const p = getPool();
  for (const [featureKey, val] of Object.entries(features)) {
    let enabled = true;
    let config = {};
    if (typeof val === 'boolean') {
      enabled = val;
    } else if (val && typeof val === 'object') {
      if ('enabled' in val) enabled = val.enabled !== false;
      if (val.config && typeof val.config === 'object') {
        config = val.config;
      } else {
        const { enabled: _e, config: _c, ...rest } = val;
        if (Object.keys(rest).length) config = rest;
      }
    }
    await p.query(
      `INSERT INTO tenant_features (tenant_id, feature_key, enabled, config)
       VALUES ($1,$2,$3,$4::jsonb)
       ON CONFLICT (tenant_id, feature_key) DO UPDATE SET enabled = $3, config = $4`,
      [tenantId, featureKey, enabled, JSON.stringify(config)],
    );
  }
}

export async function upsertBranding(tenantId, brand, subdomain) {
  await getPool().query(
    `INSERT INTO tenant_branding (tenant_id, brand, subdomain)
     VALUES ($1,$2::jsonb,$3)
     ON CONFLICT (tenant_id) DO UPDATE SET brand = $2, subdomain = $3`,
    [tenantId, JSON.stringify(brand), subdomain ?? null],
  );
}

export async function getTenantScoped(tenantId) {
  const { rows } = await tenantQuery(
    getPool(),
    tenantId,
    'SELECT * FROM tenants WHERE id = $1',
    [tenantId],
  );
  return rows.length ? tenantRow(rows[0]) : null;
}

export async function patchTenantPlatform(id, patch) {
  const fields = [];
  const vals = [];
  let i = 1;
  const map = {
    name: 'name',
    status: 'status',
    ownerEmail: 'owner_email',
    primaryContactPhone: 'primary_contact_phone',
    billingPlanId: 'billing_plan_id',
  };
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      fields.push(`${col} = $${i++}`);
      vals.push(patch[k]);
    }
  }
  if (!fields.length) return getTenantPlatform(id);
  vals.push(id);
  await getPool().query(
    `UPDATE tenants SET ${fields.join(', ')}, updated_at = now() WHERE id = $${i}`,
    vals,
  );
  return getTenantPlatform(id);
}

export async function suspendTenant(id) {
  await getPool().query(
    `UPDATE tenants SET status = 'suspended', updated_at = now() WHERE id = $1`,
    [id],
  );
  return getTenantPlatform(id);
}

export async function addDomain(tenantId, domain, isPrimary = false) {
  const token = randomUUID().replace(/-/g, '');
  const { rows } = await getPool().query(
    `INSERT INTO tenant_domains (tenant_id, domain, is_primary, verification_token)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [tenantId, domain.toLowerCase(), isPrimary, token],
  );
  return {
    id: rows[0].id,
    domain: rows[0].domain,
    isPrimary: rows[0].is_primary,
    sslStatus: rows[0].ssl_status,
    verificationToken: rows[0].verification_token,
    dnsInstructions: `CNAME ${domain} → ${process.env.BLINKONE_CNAME_TARGET || 'ingress.blinkone.ai'}`,
  };
}

export async function listDomains(tenantId) {
  const { rows } = await tenantQuery(
    getPool(),
    tenantId,
    'SELECT * FROM tenant_domains WHERE tenant_id = $1 ORDER BY is_primary DESC, domain',
    [tenantId],
  );
  return rows.map((r) => ({
    id: r.id,
    domain: r.domain,
    isPrimary: r.is_primary,
    sslStatus: r.ssl_status,
  }));
}

export async function listFeatures(tenantId) {
  const { rows } = await tenantQuery(
    getPool(),
    tenantId,
    'SELECT feature_key, enabled, config FROM tenant_features WHERE tenant_id = $1',
    [tenantId],
  );
  return Object.fromEntries(rows.map((r) => [r.feature_key, { enabled: r.enabled, config: r.config }]));
}

export async function getBranding(tenantId) {
  const { rows } = await getPool().query(
    'SELECT brand, subdomain FROM tenant_branding WHERE tenant_id = $1',
    [tenantId],
  );
  if (!rows.length) return { brand: {}, subdomain: null };
  return { brand: rows[0].brand ?? {}, subdomain: rows[0].subdomain };
}

export async function patchBranding(tenantId, brand, subdomain) {
  await upsertBranding(tenantId, brand, subdomain);
  return getBranding(tenantId);
}

export async function getUsageSnapshot(tenantId) {
  try {
    const { fetchTenantUsage } = await import('./billing-client.js');
    return await fetchTenantUsage(tenantId);
  } catch (e) {
    return {
      tenantId,
      period: new Date().toISOString().slice(0, 7),
      error: e.message,
      billing: { note: 'Billing service unavailable' },
    };
  }
}
