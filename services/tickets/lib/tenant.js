import { requireTenantId, resolveTenantIdFromReq } from '../_shared/lib/tenant-id.js';

export function resolveTenantId(req) {
  try {
    return requireTenantId(req, { allowQuery: true, allowBody: true });
  } catch {
    return resolveTenantIdFromReq(req, { allowQuery: true, allowBody: true }) || 'default';
  }
}

export function resolveAccountId(req) {
  const fromQuery = Number(req.query?.chatwoot_account_id);
  if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery;
  const header = Number(req.headers['x-blinkone-account-id']);
  if (Number.isFinite(header) && header > 0) return header;
  const tenant = Number(resolveTenantId(req));
  if (Number.isFinite(tenant) && tenant > 0) return tenant;
  return NaN;
}
