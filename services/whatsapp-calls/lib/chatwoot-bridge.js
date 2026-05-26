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

const log = createLogger('whatsapp-bridge');

const CW_URL = (process.env.CHATWOOT_BASE_URL || 'http://chatwoot:3000').replace(/\/$/, '');
const CW_TOKEN = (process.env.CHATWOOT_API_ACCESS_TOKEN || '').trim();
const CW_ACCOUNT = (process.env.CHATWOOT_ACCOUNT_ID || '1').trim();
const WA_INBOX_ID = (process.env.WHATSAPP_INBOX_ID || '').trim();

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
  if (!WA_INBOX_ID) {
    throw new Error(
      'WHATSAPP_INBOX_ID is not set. Create a WhatsApp inbox in Chatwoot and set this env var.',
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
      (c) => c.status === 'open' && String(c.inbox_id) === String(WA_INBOX_ID),
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
        inbox_id: Number(WA_INBOX_ID),
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
 * Post an incoming WhatsApp message as an agent message into a Chatwoot conversation.
 * @param {number} conversationId
 * @param {string} content — message text
 * @param {object} [meta]
 */
async function postMessage(conversationId, content, meta = {}) {
  const body = {
    content,
    message_type: 'incoming',
    content_type: 'text',
    private: false,
    ...meta,
  };
  const res = await fetch(
    `${CW_URL}/api/v1/accounts/${CW_ACCOUNT}/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: cwHeaders(),
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    log.warn({ status: res.status, conversationId }, 'chatwoot message post failed');
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
  if (!CW_TOKEN) {
    log.warn('CHATWOOT_API_ACCESS_TOKEN not set — bridge disabled');
    return null;
  }

  const phone = msg.from.startsWith('+') ? msg.from : `+${msg.from}`;
  const name = msg.profileName || phone;

  try {
    const contactId = await findOrCreateContact(phone, name);
    const conversationId = await findOrCreateConversation(contactId);

    // Post message content into the conversation
    let content = '';
    switch (msg.type) {
      case 'text':
        content = msg.text?.body ?? '';
        break;
      case 'image':
        content = `[Image]${msg.image?.caption ? `: ${msg.image.caption}` : ''}`;
        break;
      case 'video':
        content = `[Video]${msg.video?.caption ? `: ${msg.video.caption}` : ''}`;
        break;
      case 'audio':
        content = '[Voice Message]';
        break;
      case 'document':
        content = `[Document: ${msg.document?.filename ?? 'file'}]${msg.document?.caption ? ` — ${msg.document.caption}` : ''}`;
        break;
      case 'location':
        content = `[Location: ${msg.location?.latitude ?? ''}, ${msg.location?.longitude ?? ''}]`;
        break;
      case 'sticker':
        content = '[Sticker]';
        break;
      case 'reaction':
        content = `[Reaction: ${msg.reaction?.emoji ?? ''} to message ${msg.reaction?.message_id ?? ''}]`;
        break;
      case 'interactive':
        content = msg.interactive?.button_reply?.title
          ?? msg.interactive?.list_reply?.title
          ?? '[Interactive response]';
        break;
      default:
        content = `[${msg.type} message]`;
    }

    if (content) {
      await postMessage(conversationId, content);
    }

    log.info({ contactId, conversationId, msgType: msg.type }, 'wa→chatwoot bridged');
    return { contactId, conversationId };
  } catch (err) {
    log.error({ err: err.message, phone }, 'bridge failed');
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
  if (String(conv.inbox_id) !== String(WA_INBOX_ID)) return;

  const phone = conv?.meta?.sender?.phone_number;
  if (!phone) return;

  const to = phone.replace(/^\+/, ''); // Meta API wants without +

  try {
    if (msg.content_type === 'text' || msg.content_type === 'html' || !msg.content_type) {
      const text = (msg.content ?? '').replace(/<[^>]+>/g, '').trim();
      if (text) await sendText(to, text);
    } else if (msg.attachments?.length) {
      for (const att of msg.attachments) {
        const mediaType = att.file_type?.startsWith('image') ? 'image'
          : att.file_type?.startsWith('video') ? 'video'
          : att.file_type?.startsWith('audio') ? 'audio'
          : 'document';
        await sendMedia(to, mediaType, att.data_url, msg.content, att.file_name);
      }
    }
    log.info({ to, convId: conv.id }, 'chatwoot→wa sent');
  } catch (err) {
    log.error({ err: err.message, to }, 'outbound send failed');
  }
}
