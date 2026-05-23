import express from 'express';
import { createLogger } from '../lib/logger.js';
import { ok, fail, bearerAuth, requestId, errorHandler, healthRouter, gracefulShutdown } from '../lib/http.js';
import { verifyWebhook, handleWebhook } from '../lib/meta-webhook.js';
import { storeOffer, setAnswer, getSession } from '../lib/sdp-relay.js';

const log = createLogger('whatsapp-calls');
const PORT = parseInt(process.env.PORT || '8803', 10);
const TOKEN = (process.env.TOKEN || '').trim();
const ENABLED = process.env.WHATSAPP_CALLING_ENABLED === '1';

const auth = bearerAuth(TOKEN);
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(requestId);
healthRouter(app, 'whatsapp-calls');

app.get('/v1/health', (_req, res) => res.json({ status: 'ok', enabled: ENABLED }));

app.get('/v1/webhooks/meta', (req, res) => {
  const v = verifyWebhook(req);
  if (v.ok) return res.status(200).send(v.challenge);
  return res.status(403).send('Forbidden');
});

app.post('/v1/webhooks/meta', (req, res) => {
  if (!ENABLED) return fail(res, 'DISABLED', 'WhatsApp calling not enabled', 503);
  const evt = handleWebhook(req.body);
  log.info({ evt }, 'meta webhook');
  ok(res, { received: true, evt });
});

app.post('/v1/calls/:id/sdp', auth, (req, res) => {
  if (!ENABLED) return fail(res, 'DISABLED', 'WhatsApp calling not enabled', 503);
  const { offer, answer } = req.body ?? {};
  if (offer) storeOffer(req.params.id, offer);
  if (answer) setAnswer(req.params.id, answer);
  ok(res, getSession(req.params.id) || {});
});

app.use(errorHandler(log));
const server = app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT, enabled: ENABLED }, 'whatsapp-calls started'));
gracefulShutdown(server, log);
