import jwt from 'jsonwebtoken';
import express from 'express';

const CUSTOMER_ACCOUNT = () => String(process.env.CUSTOMER_DEFAULT_ACCOUNT || process.env.IVR_DEFAULT_TENANT || '1');
const CW_TOKEN = () =>
  (process.env.CUSTOMER_CHATWOOT_TOKEN || process.env.CHATWOOT_SERVICE_TOKEN || '').trim();

async function cwApi(path, init = {}) {
  const token = CW_TOKEN();
  if (!token) throw new Error('CUSTOMER_CHATWOOT_TOKEN not configured');
  const base = (process.env.CHATWOOT_UPSTREAM || 'http://chatwoot:3000').replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      api_access_token: token,
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.message || body?.error || `Chatwoot ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

async function findContactByEmail(accountId, email) {
  if (!email) return null;
  const q = encodeURIComponent(email.trim());
  const result = await cwApi(`/accounts/${accountId}/contacts/search?q=${q}&page=1`);
  const list = result?.payload ?? result ?? [];
  const needle = email.trim().toLowerCase();
  const hit = list.find((c) => String(c?.email || '').toLowerCase() === needle);
  return hit?.id ?? null;
}

async function findOrCreateContact(accountId, { name, email, phone }) {
  const created = await cwApi(`/accounts/${accountId}/contacts`, {
    method: 'POST',
    body: JSON.stringify({ name, email, phone_number: phone }),
  });
  return created?.payload?.contact?.id ?? created?.id ?? null;
}

function issueCustomerJwt(payload, secret, expiresIn = 30 * 24 * 60 * 60) {
  return jwt.sign(payload, secret, { expiresIn, issuer: 'blinkone-gateway' });
}

function authenticateCustomerJwt(JWT_SECRET) {
  return (req, res, next) => {
    const auth = String(req.headers.authorization || '');
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Bearer token required' } });
    }
    try {
      const payload = jwt.verify(auth.slice(7).trim(), JWT_SECRET);
      if (!(payload.roles || []).includes('customer')) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Customer token required' } });
      }
      req.customerAuth = payload;
      req.headers['x-blinkone-tenant-id'] = String(payload.tenant_id ?? payload.account_id ?? '');
      next();
    } catch {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
    }
  };
}

export function mountCustomerRoutes(app, { JWT_SECRET, log, U, TOKENS }) {
  const customerAuth = authenticateCustomerJwt(JWT_SECRET);

  /** Public — start or resume complainant session */
  app.post('/api/customer/session', express.json(), async (req, res) => {
    if (!CW_TOKEN()) {
      return res.status(503).json({
        error: { code: 'NOT_CONFIGURED', message: 'Set CUSTOMER_CHATWOOT_TOKEN on gateway' },
      });
    }
    const accountId = String(req.body?.accountId ?? CUSTOMER_ACCOUNT());
    const name = String(req.body?.name ?? 'Mobile Customer').trim() || 'Mobile Customer';
    const email = req.body?.email ? String(req.body.email).trim() : undefined;
    const phone = req.body?.phone ? String(req.body.phone).trim() : undefined;
    const existingContactId = req.body?.contactId ? Number(req.body.contactId) : null;

    try {
      let contactId = existingContactId;
      if (!contactId) {
        contactId = await findContactByEmail(accountId, email);
      }
      if (!contactId) {
        try {
          contactId = await findOrCreateContact(accountId, { name, email, phone });
        } catch (e) {
          const msg = String(e?.message || e);
          if (email && /already been taken|has already been taken/i.test(msg)) {
            contactId = await findContactByEmail(accountId, email);
          }
          if (!contactId) throw e;
        }
      }
      if (!contactId) throw new Error('Failed to create contact');

      const inboxes = await cwApi(`/accounts/${accountId}/inboxes`);
      const inbox = (inboxes?.payload ?? inboxes ?? [])[0];
      if (!inbox?.id) throw new Error('No inbox configured for account');

      let conversationId = req.body?.conversationId ? Number(req.body.conversationId) : null;
      if (!conversationId) {
        const conv = await cwApi(`/accounts/${accountId}/conversations`, {
          method: 'POST',
          body: JSON.stringify({ inbox_id: inbox.id, contact_id: contactId, status: 'open' }),
        });
        conversationId = conv?.id ?? conv?.payload?.id;
      }

      const token = issueCustomerJwt(
        {
          sub: String(contactId),
          contact_id: contactId,
          tenant_id: accountId,
          account_id: Number(accountId),
          roles: ['customer'],
          name,
        },
        JWT_SECRET,
      );

      return res.json({
        token,
        contactId,
        accountId: Number(accountId),
        conversationId,
        inboxId: inbox.id,
        name,
      });
    } catch (e) {
      const message = String(e?.message || e);
      log.error({ err: message }, 'customer session');
      return res.status(502).json({ error: { code: 'SESSION_FAILED', message } });
    }
  });

  /** Customer-scoped ticket list/create — proxied with contact_id injected */
  app.get('/api/customer/tickets', customerAuth, async (req, res) => {
    if (!U.tickets || !TOKENS.ticket) {
      return res.status(501).json({ error: { code: 'NOT_CONFIGURED', message: 'Tickets service unavailable' } });
    }
    const contactId = req.customerAuth.contact_id;
    const qs = new URLSearchParams(req.query);
    qs.set('contact_id', String(contactId));
    qs.set('chatwoot_account_id', String(req.customerAuth.account_id ?? req.customerAuth.tenant_id));
    try {
      const r = await fetch(`${U.tickets}/v1/tickets?${qs}`, {
        headers: { Authorization: `Bearer ${TOKENS.ticket}`, Accept: 'application/json' },
      });
      const body = await r.json();
      return res.status(r.status).json(body);
    } catch (e) {
      return res.status(502).json({ error: { code: 'BAD_GATEWAY', message: e.message } });
    }
  });

  app.post('/api/customer/tickets', customerAuth, express.json(), async (req, res) => {
    if (!U.tickets || !TOKENS.ticket) {
      return res.status(501).json({ error: { code: 'NOT_CONFIGURED', message: 'Tickets service unavailable' } });
    }
    const payload = {
      ...req.body,
      contactId: String(req.customerAuth.contact_id),
      chatwootAccountId: req.customerAuth.account_id ?? Number(req.customerAuth.tenant_id),
      customerName: req.customerAuth.name ?? req.body?.customerName ?? 'Customer',
    };
    try {
      const r = await fetch(`${U.tickets}/v1/tickets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKENS.ticket}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const body = await r.json();
      return res.status(r.status).json(body);
    } catch (e) {
      return res.status(502).json({ error: { code: 'BAD_GATEWAY', message: e.message } });
    }
  });

  app.get('/api/customer/tickets/:id', customerAuth, async (req, res) => {
    if (!U.tickets || !TOKENS.ticket) {
      return res.status(501).json({ error: { code: 'NOT_CONFIGURED', message: 'Tickets service unavailable' } });
    }
    try {
      const r = await fetch(`${U.tickets}/v1/tickets/${encodeURIComponent(req.params.id)}`, {
        headers: {
          Authorization: `Bearer ${TOKENS.ticket}`,
          Accept: 'application/json',
          'X-Chatwoot-Account-Id': String(req.customerAuth.account_id ?? req.customerAuth.tenant_id),
        },
      });
      const body = await r.json();
      return res.status(r.status).json(body);
    } catch (e) {
      return res.status(502).json({ error: { code: 'BAD_GATEWAY', message: e.message } });
    }
  });

  /** Customer chat proxy — messages for owned conversation */
  app.get('/api/customer/conversations/:id/messages', customerAuth, async (req, res) => {
    const accountId = req.customerAuth.account_id ?? req.customerAuth.tenant_id;
    try {
      const data = await cwApi(`/accounts/${accountId}/conversations/${req.params.id}/messages`);
      return res.json(data);
    } catch (e) {
      return res.status(502).json({ error: { code: 'BAD_GATEWAY', message: e.message } });
    }
  });

  app.post('/api/customer/conversations/:id/messages', customerAuth, express.json(), async (req, res) => {
    const accountId = req.customerAuth.account_id ?? req.customerAuth.tenant_id;
    try {
      const data = await cwApi(`/accounts/${accountId}/conversations/${req.params.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: req.body?.content ?? '', private: false }),
      });
      return res.json(data);
    } catch (e) {
      return res.status(502).json({ error: { code: 'BAD_GATEWAY', message: e.message } });
    }
  });

  app.get('/api/customer/conversations/:id', customerAuth, async (req, res) => {
    const accountId = req.customerAuth.account_id ?? req.customerAuth.tenant_id;
    try {
      const data = await cwApi(`/accounts/${accountId}/conversations/${req.params.id}`);
      return res.json(data);
    } catch (e) {
      return res.status(502).json({ error: { code: 'BAD_GATEWAY', message: e.message } });
    }
  });

  async function serviceJson(upstream, path, token, opts = {}) {
    if (!upstream || !token) throw new Error('Service not configured');
    const { method = 'GET', tenantId = '', body, headers = {} } = opts;
    const res = await fetch(`${upstream.replace(/\/$/, '')}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Blinkone-Tenant-Id': String(tenantId),
        ...headers,
      },
      ...(body != null ? { body } : {}),
    });
    const parsed = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = parsed?.error?.message ?? parsed?.message ?? `Upstream ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return parsed;
  }

  /** User mobile — enqueue or assign via ACD, then start SIP leg client-side */
  app.post('/api/customer/call/request', customerAuth, express.json(), async (req, res) => {
    const tenantId = String(req.customerAuth.tenant_id ?? req.customerAuth.account_id ?? '1');
    const queueKey = String(req.body?.queueKey ?? process.env.SUPPORT_QUEUE ?? 'support').trim();
    const callId = String(req.body?.callId ?? `cust-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    let callerName = String(req.body?.callerName ?? req.customerAuth.name ?? '').trim();
    const callerPhone = String(req.body?.callerPhone ?? req.body?.callerId ?? '').trim();
    const contactId = req.body?.contactId ?? req.customerAuth.contact_id ?? null;

    if (!callerName && contactId && CW_TOKEN()) {
      try {
        const contact = await cwApi(`/accounts/${tenantId}/contacts/${contactId}`);
        callerName =
          contact?.payload?.name?.trim?.() ??
          contact?.name?.trim?.() ??
          callerName;
      } catch {
        /* optional */
      }
    }
    if (!callerName) callerName = 'Mobile Customer';

    const callerId = callerPhone || callerName || String(req.body?.callerId ?? req.customerAuth.sub ?? 'customer');
    const displayPhone = callerName || callerPhone || callerId;

    let welcomeMessage =
      'Welcome to BlinkOne support. Please wait while we connect you to an agent.';
    if (U.ivr && TOKENS.ivr) {
      try {
        const welcome = await serviceJson(U.ivr, '/v1/flows/welcome', TOKENS.ivr, {
          method: 'GET',
          tenantId,
        });
        welcomeMessage = welcome?.data?.message ?? welcome?.message ?? welcomeMessage;
      } catch (welcomeErr) {
        log.warn({ err: welcomeErr.message, tenantId }, 'ivr welcome skipped');
      }
    }

    if (!U.routing || !TOKENS.routing) {
      return res.status(503).json({ error: { code: 'NOT_CONFIGURED', message: 'Routing service unavailable' } });
    }

    try {
      let sessionId = null;
      if (U.calls && TOKENS.calls) {
        try {
          const created = await serviceJson(U.calls, '/v1/calls', TOKENS.calls, {
            method: 'POST',
            tenantId,
            body: JSON.stringify({
              chatwootAccountId: Number(tenantId),
              roomId: callId,
              customerPhone: displayPhone,
              contactId: contactId ? String(contactId) : undefined,
              direction: 'inbound',
              transport: 'webrtc',
              queueKey,
              metadata: {
                externalCallId: callId,
                callerName: callerName || undefined,
                callerPhone: callerPhone || undefined,
                contactId: contactId ? String(contactId) : undefined,
              },
            }),
          });
          sessionId = created?.data?.id ?? null;
        } catch (callErr) {
          log.warn({ err: callErr.message, tenantId, callId }, 'customer call session create skipped');
        }
      }

      const route = await serviceJson(U.routing, '/v1/route/request', TOKENS.routing, {
        method: 'POST',
        tenantId,
        body: JSON.stringify({
          callId,
          queueKey,
          callerId,
          callerName: callerName || undefined,
          callerPhone: callerPhone || undefined,
          contactId: contactId ? String(contactId) : undefined,
        }),
      });

      const data = route?.data ?? route;
      return res.status(202).json({
        callId,
        sessionId,
        welcomeMessage,
        eventType: data?.status === 'queued' ? 'call:queued' : 'call:ringing',
        ...data,
      });
    } catch (e) {
      const status = e.status === 503 ? 503 : 502;
      return res.status(status).json({ error: { code: 'CALL_REQUEST_FAILED', message: e.message } });
    }
  });

  app.post('/api/customer/call/:callId/cancel', customerAuth, express.json(), async (req, res) => {
    const tenantId = String(req.customerAuth.tenant_id ?? req.customerAuth.account_id ?? '1');
    if (!U.routing || !TOKENS.routing) {
      return res.status(503).json({ error: { code: 'NOT_CONFIGURED', message: 'Routing unavailable' } });
    }
    try {
      const route = await serviceJson(
        U.routing,
        `/v1/route/calls/${encodeURIComponent(req.params.callId)}/abandon`,
        TOKENS.routing,
        { method: 'POST', tenantId, body: JSON.stringify({ reason: 'caller_cancel' }) },
      );
      return res.json(route?.data ?? route);
    } catch (e) {
      return res.status(502).json({ error: { code: 'BAD_GATEWAY', message: e.message } });
    }
  });

  app.get('/api/customer/call/:callId/status', customerAuth, async (req, res) => {
    const tenantId = String(req.customerAuth.tenant_id ?? req.customerAuth.account_id ?? '1');
    if (!U.routing || !TOKENS.routing) {
      return res.status(503).json({ error: { code: 'NOT_CONFIGURED', message: 'Routing unavailable' } });
    }
    try {
      const route = await serviceJson(
        U.routing,
        `/v1/route/calls/${encodeURIComponent(req.params.callId)}/status`,
        TOKENS.routing,
        { tenantId },
      );
      return res.json(route?.data ?? route);
    } catch (e) {
      return res.status(502).json({ error: { code: 'BAD_GATEWAY', message: e.message } });
    }
  });
}
