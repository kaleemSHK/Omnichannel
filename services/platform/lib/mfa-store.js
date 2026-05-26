/**
 * MFA enrollment store — Sprint 2 M01
 *
 * Persists per-user TOTP enrollment in the platform file-store.
 * Each entry is keyed by `{tenantId}:{userId}` to prevent cross-tenant
 * secret reuse.
 *
 * Schema added to platform file-store root:
 *   mfa: {
 *     "<tenantId>:<userId>": {
 *       secret: string,        // base32 TOTP secret
 *       confirmed: boolean,    // false until user has verified first code
 *       confirmedAt: string?,  // ISO timestamp
 *       enrolledAt: string,    // ISO timestamp
 *       label: string,         // email used as label in authenticator
 *     }
 *   }
 */

import { createStore } from './store.js';

const store = createStore(process.env.DATA_DIR || './data', () => ({
  tenants: [],
  apiKeys: [],
  auditLog: [],
  brandingOverrides: {},
  tenantBrandAssets: {},
  mfa: {},
  seq: { nextTenantId: 2 },
}));

function key(tenantId, userId) {
  return `${tenantId}:${userId}`;
}

/** Return the MFA record for a user, or null. */
export function getEnrollment(tenantId, userId) {
  const s = store.load();
  return (s.mfa ?? {})[key(tenantId, userId)] ?? null;
}

/** Create or replace an enrollment record (confirmed=false until verifyEnrollment). */
export async function startEnrollment(tenantId, userId, { secret, label }) {
  return store.withStore((s) => {
    if (!s.mfa) s.mfa = {};
    const k = key(tenantId, userId);
    s.mfa[k] = {
      secret,
      confirmed:   false,
      enrolledAt:  new Date().toISOString(),
      confirmedAt: null,
      label:       label ?? '',
    };
    return s.mfa[k];
  });
}

/**
 * Mark an enrollment as confirmed (user has verified their first code).
 * Returns the updated record or null if no pending enrollment.
 */
export async function confirmEnrollment(tenantId, userId) {
  return store.withStore((s) => {
    if (!s.mfa) s.mfa = {};
    const k = key(tenantId, userId);
    const rec = s.mfa[k];
    if (!rec) return null;
    rec.confirmed   = true;
    rec.confirmedAt = new Date().toISOString();
    return rec;
  });
}

/** Remove MFA enrollment for a user. */
export async function deleteEnrollment(tenantId, userId) {
  return store.withStore((s) => {
    if (!s.mfa) return;
    delete s.mfa[key(tenantId, userId)];
  });
}

/** Returns true if the user has an active, confirmed MFA enrollment. */
export function isMfaEnabled(tenantId, userId) {
  const rec = getEnrollment(tenantId, userId);
  return rec != null && rec.confirmed === true;
}
