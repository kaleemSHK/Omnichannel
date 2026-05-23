import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const RETRY_DELAYS_SEC = [60, 300, 1800, 7200, 43200, 86400];

export function hashSecret(secret) {
  return createHash('sha256').update(secret).digest('hex');
}

export function signPayload(secret, body) {
  const t = Math.floor(Date.now() / 1000);
  const payload = `${t}.${typeof body === 'string' ? body : JSON.stringify(body)}`;
  const v1 = createHmac('sha256', secret).update(payload).digest('hex');
  return { header: `t=${t},v1=${v1}`, timestamp: t };
}

export function verifySignature(secret, rawBody, signatureHeader) {
  if (!secret || !signatureHeader) return false;
  const parts = Object.fromEntries(
    String(signatureHeader)
      .split(',')
      .map((p) => p.trim().split('='))
      .filter((x) => x.length === 2),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
  const expected = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function nextRetryAt(attempt) {
  const delay = RETRY_DELAYS_SEC[Math.min(attempt - 1, RETRY_DELAYS_SEC.length - 1)] ?? 86400;
  return new Date(Date.now() + delay * 1000).toISOString();
}

export function generateSecret() {
  return randomBytes(24).toString('hex');
}
