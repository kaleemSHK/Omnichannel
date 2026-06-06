import express from 'express';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { sendIncomingCallPush } from './push.js';

const STORE = process.env.DEVICE_STORE_PATH || '/tmp/blinkone-devices.json';

function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE, 'utf8'));
  } catch {
    return { devices: [] };
  }
}

function saveStore(data) {
  const dir = path.dirname(STORE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify(data, null, 2));
}

export function mountDeviceRoutes(app, { JWT_SECRET, log, jwt }) {
  app.post('/api/devices/register', express.json(), async (req, res) => {
    const auth = String(req.headers.authorization || '');
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Bearer token required' } });
    }
    let payload;
    try {
      payload = jwt.verify(auth.slice(7).trim(), JWT_SECRET);
    } catch {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }

    const { pushToken, platform = 'android', deviceId } = req.body ?? {};
    if (!pushToken || typeof pushToken !== 'string') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'pushToken required' } });
    }

    const userId = String(payload.sub);
    const tenantId = String(payload.tenant_id ?? payload.account_id ?? 'default');
    const tokenHash = createHmac('sha256', JWT_SECRET).update(pushToken).digest('hex').slice(0, 16);

    const store = loadStore();
    const now = new Date().toISOString();
    const row = {
      userId,
      tenantId,
      platform,
      pushToken,
      tokenHash,
      deviceId: deviceId ? String(deviceId) : undefined,
      roles: payload.roles ?? [],
      updatedAt: now,
    };
    store.devices = (store.devices ?? []).filter(
      (d) => !(d.userId === userId && d.platform === platform && d.tokenHash === tokenHash),
    );
    store.devices.push(row);
    saveStore(store);

    log.info({ userId, platform, tenantId }, 'device registered');
    return res.json({ ok: true, registered: true });
  });

  /** Internal — list devices for a user (calls service / push worker) */
  app.get('/api/devices', express.json(), async (req, res) => {
    const svc = String(req.headers.authorization || '').replace('Bearer ', '').trim();
    const platformToken = (process.env.PLATFORM_TOKEN || '').trim();
    if (!platformToken || svc !== platformToken) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Service token required' } });
    }
    const userId = req.query.user_id ? String(req.query.user_id) : null;
    const store = loadStore();
    let list = store.devices ?? [];
    if (userId) list = list.filter((d) => d.userId === userId);
    return res.json({ data: list.map(({ pushToken, ...rest }) => ({ ...rest, hasToken: !!pushToken })) });
  });

  /** Internal — FCM wake for ringing calls (calls service → gateway) */
  app.post('/api/internal/push/call-ringing', express.json(), async (req, res) => {
    const svc = String(req.headers.authorization || '').replace('Bearer ', '').trim();
    const platformToken = (process.env.PLATFORM_TOKEN || '').trim();
    if (!platformToken || svc !== platformToken) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Service token required' } });
    }

    const { tenantId, session } = req.body ?? {};
    if (!session?.id) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'session.id required' } });
    }

    const store = loadStore();
    const devices = (store.devices ?? []).filter(
      (d) => !tenantId || String(d.tenantId) === String(tenantId),
    );
    const tokens = devices.map((d) => d.pushToken).filter(Boolean);

    const result = await sendIncomingCallPush(tokens, {
      sessionId: session.id,
      customerPhone: session.customerPhone,
      transport: session.transport,
      conversationId: session.conversationId,
      callerName: session.agentLabel,
    });

    log.info(
      { tenantId, callId: session.id, devices: devices.length, sent: result.sent, failed: result.failed },
      'incoming call push',
    );
    return res.json({ ok: true, ...result });
  });
}
