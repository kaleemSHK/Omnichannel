/**
 * Generic REST connector — maps BlinkOne events to configurable HTTP calls.
 *
 * ctx.config shape:
 *   baseUrl    : 'https://erp.example.com/api'
 *   authType   : 'bearer' | 'basic' | 'api_key' | 'none'
 *   authValue  : token / "user:pass" / api-key string
 *   apiKeyHeader : header name when authType='api_key' (default: 'X-API-Key')
 *   idField    : field name for record ID in responses (default: 'id')
 *   nameField  : field name for name in contact response (default: 'name')
 *   emailField : field name for email (default: 'email')
 *   phoneField : field name for phone (default: 'phone')
 *   pingPath   : path to GET for health check (default: '/')
 *   mappings   : { "event.type": { method, path, body? } }  — webhook push
 *   lookup     : {
 *                  path: '/contacts?email={email}&phone={phone}',
 *                  method: 'GET',
 *                  resultPath: 'data.0'    // dot-path into JSON response for the single record
 *                }
 */

function authHeaders(cfg) {
  const { authType, authValue, apiKeyHeader = 'X-API-Key' } = cfg ?? {};
  if (authType === 'bearer') return { Authorization: `Bearer ${authValue}` };
  if (authType === 'basic') {
    return { Authorization: `Basic ${Buffer.from(authValue ?? '').toString('base64')}` };
  }
  if (authType === 'api_key') return { [apiKeyHeader]: authValue };
  return {};
}

function interpolate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(vars[k] ?? ''));
}

function resolvePath(obj, dotPath) {
  if (!dotPath) return obj;
  return dotPath.split('.').reduce((cur, seg) => {
    if (cur == null) return undefined;
    if (seg === '0' || /^\d+$/.test(seg)) return Array.isArray(cur) ? cur[parseInt(seg, 10)] : cur;
    return cur[seg];
  }, obj);
}

async function restCall(ctx, ep, vars) {
  if (!ep) return null;
  const base = (ctx.config.baseUrl ?? '').replace(/\/$/, '');
  const path = interpolate(ep.path ?? '/', vars);
  const method = (ep.method ?? 'GET').toUpperCase();
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders(ctx.config), ...(ctx.secrets ? authHeaders({ authType: 'bearer', authValue: ctx.secrets.bearerToken }) : {}) },
  };
  if (ep.body && method !== 'GET') {
    const bodyStr = JSON.stringify(ep.body);
    options.body = interpolate(bodyStr, vars);
  }
  const res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, options);
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return ep.resultPath ? resolvePath(json, ep.resultPath) : json;
}

export const genericRestConnector = {
  type: 'generic_rest',

  async connect(ctx) {
    const base = ctx.config?.baseUrl;
    if (!base) return { ok: false, detail: 'baseUrl required' };
    return { ok: true };
  },

  async disconnect() {},

  async push(ctx, event) {
    const mapping = (ctx.config?.mappings ?? {})[event.type];
    if (!mapping) return { ok: true, detail: 'no mapping for event' };
    const base = (ctx.config.baseUrl ?? '').replace(/\/$/, '');
    const path = mapping.path || '/events';
    const method = (mapping.method || 'POST').toUpperCase();
    const headers = { 'Content-Type': 'application/json', ...authHeaders(ctx.config) };
    if (ctx.secrets?.bearerToken) headers.Authorization = `Bearer ${ctx.secrets.bearerToken}`;
    if (ctx.secrets?.basicUser) {
      headers.Authorization = `Basic ${Buffer.from(`${ctx.secrets.basicUser}:${ctx.secrets.basicPass ?? ''}`).toString('base64')}`;
    }
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    const res = await fetch(url, { method, headers, body: JSON.stringify({ event, tenantId: ctx.tenantId }) });
    return { ok: res.ok, detail: `HTTP ${res.status}` };
  },

  async pull() {
    return {};
  },

  async healthcheck(ctx) {
    const base = ctx.config?.baseUrl;
    if (!base) return { ok: false };
    try {
      const pingPath = ctx.config?.pingPath ?? '/';
      const res = await fetch(`${base.replace(/\/$/, '')}${pingPath}`, { method: 'GET', headers: authHeaders(ctx.config) });
      return { ok: res.status < 500, latencyMs: 0 };
    } catch {
      return { ok: false };
    }
  },

  // ─── CRM lookup (TR-53) ────────────────────────────────────────────────────

  async lookupContact(ctx, { phone, email }) {
    const ep = ctx.config?.lookup;
    if (!ep) return null; // not configured for lookup
    try {
      const result = await restCall(ctx, ep, { phone: phone ?? '', email: email ?? '' });
      if (!result) return null;
      const cfg = ctx.config ?? {};
      return {
        id:    result[cfg.idField    ?? 'id'],
        name:  result[cfg.nameField  ?? 'name'],
        email: result[cfg.emailField ?? 'email'],
        phone: result[cfg.phoneField ?? 'phone'],
        source: 'generic_rest',
        sourceLabel: ctx.config?.sourceLabel ?? 'Generic REST',
      };
    } catch (e) {
      (ctx.log ?? console).warn?.(`generic_rest lookupContact: ${e.message}`);
      return null;
    }
  },

  async createCase(ctx, { contactId, subject, description, priority }) {
    const ep = ctx.config?.endpoints?.createCase;
    const result = await restCall(ctx, ep, { contactId: contactId ?? '', subject, description, priority: priority ?? 'medium' });
    return { caseId: result?.[ctx.config?.idField ?? 'id'], source: 'generic_rest' };
  },

  async addNote(ctx, { caseId, note, agentName = 'Agent' }) {
    await restCall(ctx, ctx.config?.endpoints?.addNote, { caseId, note, agentName });
  },

  async closeCase(ctx, { caseId, resolution }) {
    await restCall(ctx, ctx.config?.endpoints?.closeCase, { caseId, resolution });
  },
};
