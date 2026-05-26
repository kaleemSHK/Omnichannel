/**
 * WhatsApp Cloud API — outbound message sender
 * Meta Graph API v19.0
 * https://developers.facebook.com/docs/whatsapp/cloud-api/messages
 */

const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

function phoneNumberId() {
  return (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
}

function accessToken() {
  return (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
}

function authHeader() {
  return { Authorization: `Bearer ${accessToken()}` };
}

/**
 * Raw send — POST to /messages.
 * @param {object} payload — full Meta messages payload
 * @returns {{ messageId: string }}
 */
export async function sendRaw(payload) {
  const pid = phoneNumberId();
  if (!pid || !accessToken()) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN must be set');
  }
  const res = await fetch(`${GRAPH_BASE}/${pid}/messages`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body?.error?.message ?? res.statusText;
    const err = new Error(`Meta API ${res.status}: ${detail}`);
    err.code = 'META_API_ERROR';
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  return { messageId: json.messages?.[0]?.id ?? null };
}

/**
 * Send a plain text message.
 * @param {string} to — E.164 phone number (without +)
 * @param {string} body — message text (max 4096 chars)
 */
export async function sendText(to, body) {
  return sendRaw({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body },
  });
}

/**
 * Send a template message (required for first contact within 24h window).
 * @param {string} to
 * @param {string} templateName
 * @param {string} languageCode — e.g. 'en_US', 'ar'
 * @param {Array<object>} components — template parameter components
 */
export async function sendTemplate(to, templateName, languageCode = 'en_US', components = []) {
  return sendRaw({
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components.length ? { components } : {}),
    },
  });
}

/**
 * Send a media message (image, video, audio, document).
 * @param {string} to
 * @param {'image'|'video'|'audio'|'document'} mediaType
 * @param {string} mediaUrl — publicly accessible URL
 * @param {string} [caption]
 * @param {string} [filename] — for documents
 */
export async function sendMedia(to, mediaType, mediaUrl, caption, filename) {
  const mediaPayload = { link: mediaUrl };
  if (caption) mediaPayload.caption = caption;
  if (filename && mediaType === 'document') mediaPayload.filename = filename;

  return sendRaw({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: mediaType,
    [mediaType]: mediaPayload,
  });
}

/**
 * Send a read receipt for a message.
 * @param {string} messageId — the wamid of the received message
 */
export async function markRead(messageId) {
  const pid = phoneNumberId();
  if (!pid || !accessToken()) return;
  await fetch(`${GRAPH_BASE}/${pid}/messages`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  }).catch(() => undefined); // read receipts are best-effort
}

/**
 * Download a media object by its Meta media ID.
 * Returns a Buffer containing the raw media bytes.
 * @param {string} mediaId
 * @returns {{ buffer: Buffer, mimeType: string, filename: string }}
 */
export async function downloadMedia(mediaId) {
  // Step 1: Get the media URL
  const res = await fetch(`${GRAPH_BASE}/${mediaId}`, {
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(`Media URL lookup ${res.status}`);
  const { url, mime_type: mimeType } = await res.json();

  // Step 2: Download the actual file
  const mediaRes = await fetch(url, { headers: authHeader() });
  if (!mediaRes.ok) throw new Error(`Media download ${mediaRes.status}`);
  const buffer = Buffer.from(await mediaRes.arrayBuffer());

  const ext = mimeType?.split('/')?.[1]?.split(';')?.[0] ?? 'bin';
  return { buffer, mimeType, filename: `${mediaId}.${ext}` };
}
