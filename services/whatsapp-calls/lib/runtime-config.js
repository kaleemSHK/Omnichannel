/**
 * Tenant WhatsApp config — platform store with env fallbacks.
 */

const PLATFORM_URL = (process.env.PLATFORM_URL || 'http://platform:8790').replace(/\/$/, '');
const PLATFORM_TOKEN = (process.env.PLATFORM_TOKEN || process.env.TOKEN || '').trim();
const DEFAULT_TENANT = String(process.env.BLINKONE_TENANT_ID || process.env.CHATWOOT_ACCOUNT_ID || '1').trim();

function envDefaults() {
  const base = (process.env.BLINKONE_API_URL || process.env.FRONTEND_URL || 'https://app.blinksone.com').replace(/\/$/, '');
  const phone = (process.env.WHATSAPP_BUSINESS_PHONE || '+15556712440').trim();
  return {
    metaAppId: (process.env.FB_APP_ID || process.env.WHATSAPP_META_APP_ID || '').trim(),
    metaAppSecret: (process.env.META_APP_SECRET || process.env.FB_APP_SECRET || '').trim(),
    metaVerifyToken: (process.env.META_VERIFY_TOKEN || process.env.FB_VERIFY_TOKEN || 'blinkone_wh_2026').trim(),
    phoneNumberId: (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim(),
    accessToken: (process.env.WHATSAPP_ACCESS_TOKEN || '').trim(),
    businessPhone: phone,
    chatwootInboxId: (process.env.WHATSAPP_INBOX_ID || '').trim(),
    messagingEnabled: process.env.WHATSAPP_MESSAGING_ENABLED !== '0',
    callingEnabled: process.env.WHATSAPP_CALLING_ENABLED === '1',
    allowUnsignedWebhook: process.env.WHATSAPP_ALLOW_UNSIGNED_WEBHOOK === '1',
    webhookUrl: `${base}/api/whatsapp-calls/v1/webhooks/meta`,
    chatwootWebhookUrl: `${base}/webhooks/whatsapp/${encodeURIComponent(phone)}`,
  };
}

let cache = { at: 0, config: envDefaults() };
const TTL_MS = 30_000;

async function fetchPlatformConfig(tenantId) {
  if (!PLATFORM_TOKEN) return null;
  const res = await fetch(
    `${PLATFORM_URL}/v1/internal/whatsapp-config?tenant_id=${encodeURIComponent(tenantId)}`,
    { headers: { Authorization: `Bearer ${PLATFORM_TOKEN}`, Accept: 'application/json' } },
  );
  if (!res.ok) return null;
  const body = await res.json();
  return body?.data ?? body;
}

function mergeConfig(remote) {
  const base = envDefaults();
  if (!remote || typeof remote !== 'object') return base;
  const merged = { ...base, ...remote };
  for (const key of ['metaAppSecret', 'accessToken']) {
    if (!merged[key]) merged[key] = base[key];
  }
  if (merged.businessPhone) {
    const baseUrl = (process.env.BLINKONE_API_URL || process.env.FRONTEND_URL || 'https://app.blinksone.com').replace(/\/$/, '');
    merged.chatwootWebhookUrl = `${baseUrl}/webhooks/whatsapp/${encodeURIComponent(merged.businessPhone)}`;
  }
  return merged;
}

export function runtimeConfig() {
  return cache.config;
}

export async function getRuntimeConfig(force = false) {
  const now = Date.now();
  if (!force && cache.config && now - cache.at < TTL_MS) return cache.config;

  try {
    const remote = await fetchPlatformConfig(DEFAULT_TENANT);
    cache = { at: now, config: mergeConfig(remote) };
  } catch (err) {
    console.warn('[whatsapp] platform config fetch failed — using env', err?.message || err);
    cache = { at: now, config: envDefaults() };
  }
  return cache.config;
}

export async function initRuntimeConfig() {
  cache.config = await getRuntimeConfig(true);
  return cache.config;
}

export async function refreshRuntimeConfig() {
  cache = { at: 0, config: null };
  return getRuntimeConfig(true);
}
