/**
 * WhatsApp ↔ Chatwoot bridge
 *
 * Creates contacts and conversations in Chatwoot when WhatsApp messages arrive,
 * and routes them to the right agent via BlinkOne SBR.
 *
 * Chatwoot API reference:
 *   https://www.chatwoot.com/developers/api
 */

import { createLogger } from './logger.js';
import { getRuntimeConfig } from './runtime-config.js';

const log = createLogger('whatsapp-bridge');

const CW_URL = (process.env.CHATWOOT_BASE_URL || 'http://chatwoot:3000').replace(/\/$/, '');
const CW_PUBLIC_URL = (process.env.CHATWOOT_PUBLIC_URL || process.env.FRONTEND_URL || 'https://app.blinksone.com').replace(/\/$/, '');
const CW_TOKEN = (process.env.CHATWOOT_API_ACCESS_TOKEN || '').trim();
const CW_ACCOUNT = (process.env.CHATWOOT_ACCOUNT_ID || '1').trim();

function publicAttachmentUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith('/') ? `${CW_PUBLIC_URL}${url}` : `${CW_PUBLIC_URL}/${url}`;
}

function cwHeaders() {
  return {
    'api_access_token': CW_TOKEN,
    'Content-Type': 'application/json',
  };
}

/**
 * Find or create a Chatwoot contact by phone number.
 * @param {string} phone — E.164 format including + (e.g. "+971501234567")
 * @param {string} [name]
 * @returns {Promise<number>} contactId
 */
async function findOrCreateContact(phone, name) {
  // Try to find by phone
  const searchRes = await fetch(
    `${CW_URL}/api/v1/accounts/${CW_ACCOUNT}/contacts/search?q=${encodeURIComponent(phone)}&page=1`,
    { headers: cwHeaders() },
  );
  if (searchRes.ok) {
    const { payload } = await searchRes.json();
    const match = payload?.find((c) => c.phone_number === phone);
    if (match) return match.id;
  }

  // Create new contact
  const createRes = await fetch(
    `${CW_URL}/api/v1/accounts/${CW_ACCOUNT}/contacts`,
    {
      method: 'POST',
      headers: cwHeaders(),
      body: JSON.stringify({
        name: name || phone,
        phone_number: phone,
      }),
    },
  );
  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '');
    throw new Error(`Chatwoot contact create ${createRes.status}: ${text}`);
  }
  const { id } = await createRes.json();
  return id;
}

/**
 * Find an open WhatsApp conversation for this contact, or create one.
 * @param {number} contactId
 * @returns {Promise<number>} conversationId
 */
async function findOrCreateConversation(contactId) {
  const cfg = await getRuntimeConfig();
  const inboxId = (cfg.chatwootInboxId || '').trim();
  if (!inboxId) {
    throw new Error(
      'WhatsApp inbox ID is not configured. Set it in Settings → Inboxes → WhatsApp → Integration.',
    );
  }

  // Check for open conversations with this contact in WA inbox
  const listRes = await fetch(
    `${CW_URL}/api/v1/accounts/${CW_ACCOUNT}/contacts/${contactId}/conversations`,
    { headers: cwHeaders() },
  );
  if (listRes.ok) {
    const { payload } = await listRes.json();
    const openWa = payload?.find(
      (c) => c.status === 'open' && String(c.inbox_id) === String(inboxId),
    );
    if (openWa) return openWa.id;
  }

  // Create new conversation
  const createRes = await fetch(
    `${CW_URL}/api/v1/accounts/${CW_ACCOUNT}/conversations`,
    {
      method: 'POST',
      headers: cwHeaders(),
      body: JSON.stringify({
        inbox_id: Number(inboxId),
        contact_id: contactId,
        status: 'open',
        channel: 'Channel::Whatsapp',
      }),
    },
  );
  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '');
    throw new Error(`Chatwoot conversation create ${createRes.status}: ${text}`);
  }
  const { id } = await createRes.json();
  return id;
}

/**
 * Build a Meta Cloud API message object from a normalized webhook event.
 */
function buildWaMessage(evt) {
  const base = {
    from: evt.from,
    id: evt.messageId || `wamid.blinkone.${Date.now()}`,
    timestamp: String(evt.timestamp || Math.floor(Date.now() / 1000)),
    type: evt.type,
  };
  switch (evt.type) {
    case 'text':
      return { ...base, text: evt.text };
    case 'image':
      return { ...base, image: evt.image };
    case 'video':
      return { ...base, video: evt.video };
    case 'audio':
      return { ...base, audio: evt.audio };
    case 'document':
      return { ...base, document: evt.document };
    case 'location':
      return { ...base, location: evt.location };
    case 'sticker':
      return { ...base, sticker: evt.sticker };
    case 'reaction':
      return { ...base, reaction: evt.reaction };
    case 'interactive':
      return { ...base, interactive: evt.interactive };
    default:
      return { ...base, type: 'text', text: { body: `[${evt.type} message]` } };
  }
}

/**
 * Forward incoming WhatsApp traffic to Chatwoot's native webhook handler.
 * WhatsApp inboxes reject incoming messages via the REST messages API (422).
 */
async function forwardToChatwootWebhook(evt) {
  const cfg = await getRuntimeConfig();
  const businessPhone = (cfg.businessPhone || '+15556712440').trim();
  const phoneNumberId = (cfg.phoneNumberId || '').trim();
  const displayPhone = businessPhone.replace(/^\+/, '');
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: '0',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: displayPhone,
            phone_number_id: evt.phoneNumberId || phoneNumberId,
          },
          contacts: [{
            profile: { name: evt.profileName || evt.from },
            wa_id: evt.from,
          }],
          messages: [buildWaMessage(evt)],
        },
        field: 'messages',
      }],
    }],
  };

  const url = `${CW_URL}/webhooks/whatsapp/${encodeURIComponent(businessPhone)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Chatwoot WhatsApp webhook ${res.status}: ${text}`);
  }
}

/**
 * Main entry point — process one incoming WhatsApp message and
 * ensure it lands in Chatwoot as an open conversation.
 *
 * @param {object} msg — parsed message from parseIncomingMessages()
 * @returns {Promise<{ contactId: number, conversationId: number }>}
 */
export async function bridgeToChat(msg) {
  try {
    await forwardToChatwootWebhook(msg);
    log.info({ from: msg.from?.slice(-4), msgType: msg.type }, 'wa→chatwoot bridged');
    return { ok: true };
  } catch (err) {
    log.error({ err: err.message, phone: msg.from }, 'bridge failed');
    throw err;
  }
}

/**
 * Post an outbound WhatsApp message back from Chatwoot.
 * Called by Chatwoot webhook when an agent sends a reply.
 * @param {object} event — Chatwoot message_created event body
 */
export async function handleChatwootOutbound(event) {
  const { sendText, sendMedia } = await import('./messaging.js');

  const msg = event?.message;
  const conv = event?.conversation;
  if (!msg || !conv) return;

  // Only handle outbound (agent-sent) messages in WhatsApp channel conversations
  if (msg.message_type !== 'outgoing') return;
  const cfg = await getRuntimeConfig();
  const inboxId = (cfg.chatwootInboxId || '').trim();
  if (!inboxId || String(conv.inbox_id) !== String(inboxId)) return;

  const phone = conv?.meta?.sender?.phone_number;
  if (!phone) return;

  const to = phone.replace(/^\+/, ''); // Meta API wants without +

  try {
    if (msg.content_type === 'text' || msg.content_type === 'html' || !msg.content_type) {
      const text = (msg.content ?? '').replace(/<[^>]+>/g, '').trim();
      if (text) await sendText(to, text);
    } else if (msg.attachments?.length) {
      for (const att of msg.attachments) {
        const ft = String(att.file_type || '').toLowerCase();
        const mediaType = ft.includes('image') ? 'image'
          : ft.includes('video') ? 'video'
          : ft.includes('audio') ? 'audio'
          : 'document';
        const mediaUrl = publicAttachmentUrl(att.data_url);
        if (!mediaUrl) continue;
        await sendMedia(to, mediaType, mediaUrl, msg.content, att.file_name);
      }
    }
    log.info({ to, convId: conv.id }, 'chatwoot→wa sent');
  } catch (err) {
    log.error({ err: err.message, to }, 'outbound send failed');
  }
}
