export function tenantRedisKey(tenantId, ...segments) {
  if (tenantId == null || String(tenantId).trim() === '') {
    throw new Error('tenantId is required for Redis keys');
  }
  const parts = segments.filter((s) => s != null && String(s) !== '');
  return `t:${String(tenantId).trim()}:${parts.join(':')}`;
}
