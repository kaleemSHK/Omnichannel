import { createHash, randomUUID } from 'node:crypto';

/** Emails granted platform_admin via gateway PLATFORM_ADMIN_EMAILS. */
export function configuredAdminEmails() {
  return (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

function envAdminRow(email) {
  const id = `env-${createHash('sha256').update(email).digest('hex').slice(0, 12)}`;
  const local = email.split('@')[0] || email;
  const name = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return {
    id,
    email,
    name: name || local,
    role: 'platform_admin',
    status: 'active',
    createdAt: null,
    source: 'configured',
  };
}

/** Merge JSON-store invites with env-configured platform admins. */
export function listPlatformAdmins(storeData) {
  const stored = Array.isArray(storeData?.admins) ? storeData.admins : [];
  const byEmail = new Map(stored.map(a => [String(a.email || '').toLowerCase(), a]));

  for (const email of configuredAdminEmails()) {
    if (!byEmail.has(email)) {
      byEmail.set(email, envAdminRow(email));
    } else {
      const row = byEmail.get(email);
      byEmail.set(email, { ...row, status: row.status || 'active', role: row.role || 'platform_admin' });
    }
  }

  return [...byEmail.values()].sort((a, b) => String(a.email).localeCompare(String(b.email)));
}

export function isConfiguredAdminId(id) {
  return String(id || '').startsWith('env-');
}

export function newInvitedAdmin({ email, name, role }) {
  const normalized = email.trim().toLowerCase();
  return {
    id: randomUUID(),
    email: normalized,
    name: name?.trim() || normalized.split('@')[0],
    role,
    status: 'invited',
    createdAt: new Date().toISOString(),
    source: 'invited',
  };
}
