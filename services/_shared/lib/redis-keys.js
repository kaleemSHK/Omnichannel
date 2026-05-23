/**
 * Enforced Redis key prefix (Prompt 8 — TR-38).
 * All sidecar Redis keys MUST use tenantRedisKey(); no raw global keys except platform streams.
 */
export function tenantRedisKey(tenantId, ...segments) {
  if (tenantId == null || String(tenantId).trim() === '') {
    throw new Error('tenantId is required for Redis keys');
  }
  const parts = segments.filter((s) => s != null && String(s) !== '');
  return `t:${String(tenantId).trim()}:${parts.join(':')}`;
}

/** Platform-wide streams (not tenant-scoped). */
export function platformRedisKey(...segments) {
  return `platform:${segments.join(':')}`;
}
