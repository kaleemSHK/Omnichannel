const BILLING_URL = (process.env.BILLING_URL || 'http://billing:8794').replace(/\/$/, '');
const TOKEN = (process.env.BILLING_TOKEN || '').trim();

/** Fire-and-forget usage event to billing sidecar (Prompt 9). */
export function forwardUsageToBilling({ tenantId, dimension, quantity, sourceService, sourceEventId }) {
  if (!tenantId || !dimension) return;
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  fetch(`${BILLING_URL}/v1/usage/events`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tenantId, dimension, quantity, sourceService, sourceEventId }),
  }).catch(() => {});
}
