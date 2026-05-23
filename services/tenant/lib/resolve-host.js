import { getPool } from './db.js';

export async function resolveHost(hostname) {
  const host = (hostname || '').toLowerCase().split(':')[0].trim();
  if (!host) return null;

  const p = getPool();
  const { rows: domainRows } = await p.query(
    `SELECT t.id AS tenant_id, t.slug, t.status, t.name, tb.brand, tb.subdomain, td.domain, td.is_primary
     FROM tenant_domains td
     JOIN tenants t ON t.id = td.tenant_id
     LEFT JOIN tenant_branding tb ON tb.tenant_id = t.id
     WHERE td.domain = $1 AND t.status IN ('active', 'trial')
     LIMIT 1`,
    [host],
  );
  if (domainRows.length) {
    return formatResolved(domainRows[0]);
  }

  const suffix = (process.env.BLINKONE_DOMAIN_SUFFIX || 'blinkone.local').toLowerCase();
  if (host.endsWith(`.${suffix}`)) {
    const slug = host.slice(0, -(suffix.length + 1));
    const { rows } = await p.query(
      `SELECT t.id AS tenant_id, t.slug, t.status, t.name, tb.brand, tb.subdomain
       FROM tenants t
       LEFT JOIN tenant_branding tb ON tb.tenant_id = t.id
       WHERE t.slug = $1 AND t.status IN ('active', 'trial')
       LIMIT 1`,
      [slug],
    );
    if (rows.length) return formatResolved({ ...rows[0], domain: host, is_primary: true });
  }

  return null;
}

function formatResolved(row) {
  const brand = row.brand ?? {};
  const frontendBase = brand.frontend_url
    || `https://${row.domain || `${row.slug}.${process.env.BLINKONE_DOMAIN_SUFFIX || 'blinkone.local'}`}`;
  return {
    tenantId: row.tenant_id,
    slug: row.slug,
    status: row.status,
    name: row.name,
    domain: row.domain,
    isPrimary: row.is_primary,
    branding: {
      productName: brand.product_name ?? row.name,
      primaryColor: brand.primary_color ?? '#0B5FFF',
      frontendUrl: frontendBase,
      ...brand,
    },
  };
}
