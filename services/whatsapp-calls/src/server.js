import express from 'express';
import { createLogger } from '../lib/logger.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';
import { mountMetrics } from '../_shared/lib/metrics-middleware.js';
import { verifyWebhook, verifySignature, parseWebhookEvents } from '../lib/meta-webhook.js';
import { storeOffer, setAnswer, getSession } from '../lib/sdp-relay.js';
import { bridgeToChat, handleChatwootOutbound } from '../lib/chatwoot-bridge.js';
import { sendText, sendTemplate, sendMedia, markRead } from '../lib/messaging.js';
import { initRuntimeConfig, refreshRuntimeConfig, getRuntimeConfig } from '../lib/runtime-config.js';

const log = createLogger('whatsapp-calls');
const PORT = parseInt(process.env.PORT || '8803', 10);
const TOKEN = (process.env.TOKEN || '').trim();

const auth = bearerAuth(TOKEN);

async function messagingEnabled() {
  const cfg = await getRuntimeConfig();
  return cfg.messagingEnabled !== false;
}

async function callingEnabled() {
  const cfg = await getRuntimeConfig();
  return Boolean(cfg.callingEnabled);
}
const app = express();
app.disable('x-powered-by');
app.use(requestId);
healthRouter(app, 'whatsapp-calls');
mountMetrics(app, 'whatsapp-calls');

// ─── Meta webhook — GET (verification handshake) ────────────────────────────

app.get('/v1/webhooks/meta', (req, res) => {
  const v = verifyWebhook(req);
  if (v.ok) return res.status(200).send(v.challenge);
  log.warn('Meta webhook verification failed — check META_VERIFY_TOKEN');
  return res.status(403).send('Forbidden');
});

// ─── Meta webhook — POST (incoming events) ──────────────────────────────────
// Raw body captured for signature verification BEFORE express.json() parsing

app.post(
  '/v1/webhooks/meta',
  express.raw({ type: '*/*', limit: '2mb' }),
  async (req, res) => {
    // 1. Signature verification (HMAC-SHA256)
    const sig = req.headers['x-hub-signature-256'] || '';
    if (!verifySignature(req.body, sig)) {
      log.warn('Meta webhook signature mismatch — rejected');
      return res.status(403).json({ error: 'Invalid signature' });
    }

    // Parse JSON from raw buffer
    let body;
    try {
      body = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    // Always respond 200 immediately (Meta requires <20s response)
    res.status(200).json({ ok: true });

    // 2. Process events async (fire-and-forget after 200)
    const events = parseWebhookEvents(body);
    for (const evt of events) {
      setImmediate(async () => {
        try {
          await processEvent(evt);
        } catch (err) {
          log.error({ err: err.message, eventType: evt.type }, 'event processing failed');
        }
      });
    }
  },
);

/**
 * Process one parsed webhook event.
 */
async function processEvent(evt) {
  switch (evt.type) {
    case 'message':
      await handleIncomingMessage(evt);
      break;
    case 'status':
      handleStatusUpdate(evt);
      break;
    case 'call':
      log.info({ callId: evt.callId, event: evt.event }, 'wa calling event');
      break;
    default:
      log.debug({ evt }, 'unhandled wa event type');
  }
}

async function handleIncomingMessage(evt) {
  log.info({ from: evt.from?.slice(-4).padStart(evt.from?.length ?? 4, '*'), msgType: evt.messageType }, 'wa message received');

  // Bridge to Chatwoot (creates contact + conversation + posts message)
  if (await messagingEnabled()) {
    await bridgeToChat({
      from: evt.from,
      messageId: evt.messageId,
      timestamp: evt.timestamp,
      phoneNumberId: evt.phoneNumberId,
      type: evt.messageType,
      profileName: evt.profileName,
      text: evt.text,
      image: evt.image,
      video: evt.video,
      audio: evt.audio,
      document: evt.document,
      location: evt.location,
      sticker: evt.sticker,
      reaction: evt.reaction,
      interactive: evt.interactive,
    });
  }

  // Send read receipt back to sender
  if (evt.messageId) {
    await markRead(evt.messageId);
  }
}

function handleStatusUpdate(evt) {
  if (evt.status === 'failed') {
    log.warn({ messageId: evt.messageId, errors: evt.errors }, 'wa message delivery failed');
  } else {
    log.debug({ messageId: evt.messageId, status: evt.status }, 'wa delivery status');
  }
}

// ─── Chatwoot outbound webhook ────────────────────────────────────────────────
// Called by Chatwoot when an agent sends a reply in a WhatsApp conversation.
// Set this URL in Chatwoot: Settings → Integrations → Webhooks

app.post(
  '/v1/webhooks/chatwoot',
  express.json({ limit: '1mb' }),
  async (req, res) => {
    // Respond immediately
    res.status(200).json({ ok: true });

    const event = req.body;
    // Only handle message_created for outbound WhatsApp
    if (event?.event !== 'message_created') return;

    setImmediate(async () => {
      try {
        await handleChatwootOutbound(event);
      } catch (err) {
        log.error({ err: err.message }, 'chatwoot outbound failed');
      }
    });
  },
);

// ─── Send message API (internal — called by BlinkOne services) ───────────────

/** POST /v1/messages/text */
app.post('/v1/messages/text', auth, express.json({ limit: '256kb' }), async (req, res) => {
  if (!(await messagingEnabled())) return fail(res, 'DISABLED', 'WhatsApp messaging not enabled', 503);
  const { to, body } = req.body ?? {};
  if (!to?.trim() || !body?.trim()) {
    return fail(res, 'VALIDATION_ERROR', 'to and body required', 400);
  }
  try {
    const result = await sendText(to.replace(/^\+/, ''), body);
    return ok(res, result);
  } catch (e) {
    log.error({ err: e.message }, 'send text failed');
    return fail(res, e.code ?? 'INTERNAL_ERROR', e.message, e.status ?? 500);
  }
});

/** POST /v1/messages/template */
app.post('/v1/messages/template', auth, express.json({ limit: '256kb' }), async (req, res) => {
  if (!(await messagingEnabled())) return fail(res, 'DISABLED', 'WhatsApp messaging not enabled', 503);
  const { to, templateName, languageCode, components } = req.body ?? {};
  if (!to?.trim() || !templateName?.trim()) {
    return fail(res, 'VALIDATION_ERROR', 'to and templateName required', 400);
  }
  try {
    const result = await sendTemplate(
      to.replace(/^\+/, ''),
      templateName,
      languageCode ?? 'en_US',
      components ?? [],
    );
    return ok(res, result);
  } catch (e) {
    return fail(res, e.code ?? 'INTERNAL_ERROR', e.message, e.status ?? 500);
  }
});

/** POST /v1/messages/media */
app.post('/v1/messages/media', auth, express.json({ limit: '256kb' }), async (req, res) => {
  if (!(await messagingEnabled())) return fail(res, 'DISABLED', 'WhatsApp messaging not enabled', 503);
  const { to, mediaType, mediaUrl, caption, filename } = req.body ?? {};
  const validTypes = ['image', 'video', 'audio', 'document'];
  if (!to?.trim() || !mediaType || !mediaUrl?.trim()) {
    return fail(res, 'VALIDATION_ERROR', 'to, mediaType, and mediaUrl required', 400);
  }
  if (!validTypes.includes(mediaType)) {
    return fail(res, 'VALIDATION_ERROR', `mediaType must be one of: ${validTypes.join(', ')}`, 400);
  }
  try {
    const result = await sendMedia(to.replace(/^\+/, ''), mediaType, mediaUrl, caption, filename);
    return ok(res, result);
  } catch (e) {
    return fail(res, e.code ?? 'INTERNAL_ERROR', e.message, e.status ?? 500);
  }
});

// ─── WhatsApp Calling — SDP relay ──────────────────────────────────────────

app.post('/v1/calls/:id/sdp', auth, express.json({ limit: '512kb' }), async (req, res) => {
  if (!(await callingEnabled())) return fail(res, 'DISABLED', 'WhatsApp calling not enabled', 503);
  const { offer, answer } = req.body ?? {};
  if (offer) storeOffer(req.params.id, offer);
  if (answer) setAnswer(req.params.id, answer);
  ok(res, getSession(req.params.id) || {});
});

// ─── Configuration status ────────────────────────────────────────────────────

app.get('/v1/config', auth, async (_req, res) => {
  const cfg = await getRuntimeConfig();
  ok(res, {
    messagingEnabled: cfg.messagingEnabled !== false,
    callingEnabled: Boolean(cfg.callingEnabled),
    phoneNumberIdConfigured: Boolean(cfg.phoneNumberId),
    accessTokenConfigured: Boolean(cfg.accessToken),
    appSecretConfigured: Boolean(cfg.metaAppSecret),
    inboxIdConfigured: Boolean(cfg.chatwootInboxId),
    chatwootConfigured: Boolean(process.env.CHATWOOT_API_ACCESS_TOKEN),
    verifyToken: cfg.metaVerifyToken ? '***configured***' : '(not set)',
    webhookUrl: cfg.webhookUrl,
    chatwootWebhookUrl: cfg.chatwootWebhookUrl,
  });
});

app.post('/v1/admin/reload-config', auth, async (_req, res) => {
  const cfg = await refreshRuntimeConfig();
  ok(res, { reloaded: true, inboxId: cfg.chatwootInboxId || null });
});

app.use(errorHandler(log));

const server = app.listen(PORT, '0.0.0.0', async () => {
  await initRuntimeConfig();
  const cfg = await getRuntimeConfig();
  log.info(
    { port: PORT, messaging: cfg.messagingEnabled !== false, calling: Boolean(cfg.callingEnabled) },
    'whatsapp started',
  );
  setInterval(() => {
    refreshRuntimeConfig().catch(err => log.warn({ err: err.message }, 'config refresh failed'));
  }, 30_000);
});
gracefulShutdown(server, log);
