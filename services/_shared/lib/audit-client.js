/**
 * Fire-and-forget audit event to integration service (TR-57 cross-sidecar).
 */
export async function emitAudit({
  tenantId,
  actorId = 'system',
  action,
  targetType,
  targetId,
  before,
  after,
  metadata,
}) {
  const base = (process.env.INTEGRATION_UPSTREAM || 'http://integration:8800').replace(/\/$/, '');
  const token = (process.env.INTEGRATION_TOKEN || '').trim();
  if (!token) return;
  try {
    await fetch(`${base}/v1/audit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Blinkone-Tenant-Id': String(tenantId),
        'X-Blinkone-Actor-Id': String(actorId),
      },
      body: JSON.stringify({ action, targetType, targetId, before, after, metadata }),
    });
  } catch {
    /* non-blocking */
  }
}
