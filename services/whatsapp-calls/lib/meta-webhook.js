/**
 * Meta / WhatsApp Cloud API — webhook handler
 *
 * Handles both:
 *  1. Webhook verification (GET hub.challenge)
 *  2. Incoming message events (POST — text, media, status, calling)
 *
 * Reference:
 *   https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { runtimeConfig } from './runtime-config.js';

function isPlaceholderSecret(value) {
  const v = (value || '').trim().toLowerCase();
  if (!v) return true;
  return (
    v.includes('your_')
    || v.includes('placeholder')
    || v.includes('change_me')
    || v.includes('changeme')
    || v === 'secret'
  );
}

function allowUnsignedWebhooks() {
  const cfg = runtimeConfig();
  return Boolean(cfg.allowUnsignedWebhook || process.env.WHATSAPP_ALLOW_UNSIGNED_WEBHOOK === '1');
}

// ─── Verification ──────────────────────────────────────────────────────────────

/**
 * Respond to Meta's hub.challenge verification handshake.
 * Returns { ok: true, challenge } or { ok: false }.
 */
export function verifyWebhook(req) {
  const cfg = runtimeConfig();
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = (cfg.metaVerifyToken || process.env.META_VERIFY_TOKEN || '').trim();
  if (mode === 'subscribe' && token === expected) {
    return { ok: true, challenge };
  }
  return { ok: false };
}

/**
 * Verify the X-Hub-Signature-256 header against the raw body.
 * Returns true if the signature is valid.
 * @param {Buffer} rawBody
 * @param {string} signature — value of X-Hub-Signature-256 header
 */
export function verifySignature(rawBody, signature) {
  const cfg = runtimeConfig();
  const secret = (cfg.metaAppSecret || process.env.META_APP_SECRET || process.env.FB_APP_SECRET || '').trim();

  if (allowUnsignedWebhooks()) {
    return true;
  }

  if (!secret || isPlaceholderSecret(secret)) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[whatsapp] META_APP_SECRET not set in production — rejecting unsigned webhook');
      return false;
    }
    console.warn('[whatsapp] META_APP_SECRET not set — skipping signature verification (non-production)');
    return true;
  }
  if (!signature?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const given = signature.slice('sha256='.length);
  try {
    return timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// ─── Message parsing ──────────────────────────────────────────────────────────

/**
 * Parse the raw Meta webhook body into normalized message objects.
 *
 * Returns an array of parsed events, each with:
 *   { type: 'message'|'status'|'call', ... }
 *
 * @param {object} body — raw parsed JSON from Meta
 * @returns {object[]}
 */
export function parseWebhookEvents(body) {
  const events = [];
  const entries = body?.entry ?? [];

  for (const entry of entries) {
    for (const change of (entry.changes ?? [])) {
      const value = change?.value;
      if (!value) continue;

      const metadata = value.metadata ?? {};
      const phoneNumberId = metadata.phone_number_id;

      // ── Incoming messages ──────────────────────────────────────────────────
      for (const msg of (value.messages ?? [])) {
        const profileName = value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name;
        events.push({
          type: 'message',
          messageId: msg.id,
          from: msg.from, // wa_id, no + prefix
          timestamp: Number(msg.timestamp),
          profileName,
          phoneNumberId,
          // Message type and content:
          messageType: msg.type,
          text: msg.text,
          image: msg.image,
          video: msg.video,
          audio: msg.audio,
          document: msg.document,
          location: msg.location,
          sticker: msg.sticker,
          reaction: msg.reaction,
          interactive: msg.interactive,
          referral: msg.referral,
          context: msg.context, // reply-to chain
        });
      }

      // ── Message status updates (sent/delivered/read/failed) ────────────────
      for (const status of (value.statuses ?? [])) {
        events.push({
          type: 'status',
          messageId: status.id,
          recipientId: status.recipient_id,
          status: status.status, // 'sent'|'delivered'|'read'|'failed'
          timestamp: Number(status.timestamp),
          errors: status.errors ?? [],
          phoneNumberId,
        });
      }

      // ── WhatsApp Calling events (WABA Voice API) ───────────────────────────
      for (const call of (value.calls ?? [])) {
        events.push({
          type: 'call',
          callId: call.id,
          event: call.event,
          from: value.contacts?.[0]?.wa_id,
          phoneNumberId,
        });
      }
    }
  }

  return events;
}

// ─── Legacy compat (called from old server.js) ────────────────────────────────

/**
 * @deprecated Use parseWebhookEvents() instead.
 * Kept for backward compat with existing server.js routes.
 */
export function handleWebhook(body) {
  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  return {
    callId: value?.calls?.[0]?.id,
    event: value?.calls?.[0]?.event,
    from: value?.contacts?.[0]?.wa_id,
  };
}
