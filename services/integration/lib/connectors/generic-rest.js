/** Generic REST connector — maps BlinkOne events to HTTP calls. */

export const genericRestConnector = {
  type: 'generic_rest',
  async connect(ctx) {
    const base = ctx.config?.baseUrl;
    if (!base) return { ok: false, detail: 'baseUrl required' };
    return { ok: true };
  },
  async disconnect() {},
  async push(ctx, event) {
    const mappings = ctx.config?.mappings ?? {};
    const mapping = mappings[event.type];
    if (!mapping) return { ok: true, detail: 'no mapping for event' };
    const base = (ctx.config.baseUrl || '').replace(/\/$/, '');
    const path = mapping.path || '/events';
    const method = (mapping.method || 'POST').toUpperCase();
    const headers = { 'Content-Type': 'application/json', ...(ctx.config.headers || {}) };
    if (ctx.secrets?.bearerToken) headers.Authorization = `Bearer ${ctx.secrets.bearerToken}`;
    if (ctx.secrets?.basicUser) {
      const token = Buffer.from(`${ctx.secrets.basicUser}:${ctx.secrets.basicPass || ''}`).toString('base64');
      headers.Authorization = `Basic ${token}`;
    }
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    const res = await fetch(url, {
      method,
      headers,
      body: JSON.stringify({ event, tenantId: ctx.tenantId }),
    });
    return { ok: res.ok, detail: `HTTP ${res.status}` };
  },
  async pull() {
    return {};
  },
  async healthcheck(ctx) {
    const base = ctx.config?.baseUrl;
    if (!base) return { ok: false };
    try {
      const res = await fetch(base, { method: 'GET' });
      return { ok: res.status < 500, latencyMs: 0 };
    } catch {
      return { ok: false };
    }
  },
};
