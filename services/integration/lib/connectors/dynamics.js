/**
 * Microsoft Dynamics 365 connector — AAD client-credentials flow, OData v9.2.
 *
 * ctx.config shape:
 *   aadTenantId  : Azure Active Directory tenant ID (GUID)
 *   clientId     : App registration client ID
 *   clientSecret : App registration client secret
 *   resourceUrl  : D365 environment URL e.g. 'https://myorg.crm.dynamics.com'
 */

const AAD_TOKEN_BASE = 'https://login.microsoftonline.com';
const _cache = new Map();

function cacheGet(key) {
  const entry = _cache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.token;
  _cache.delete(key);
  return null;
}

async function getToken(ctx) {
  const cacheKey = `${ctx.tenantId}:dynamics365`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const cfg = ctx.config;
  const res = await fetch(
    `${AAD_TOKEN_BASE}/${cfg.aadTenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        scope: `${cfg.resourceUrl.replace(/\/$/, '')}/.default`,
        grant_type: 'client_credentials',
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`D365 AAD auth failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  _cache.set(cacheKey, { token: json.access_token, expiry: Date.now() + (json.expires_in - 60) * 1000 });
  return json.access_token;
}

async function d365Fetch(ctx, path, options = {}) {
  const token = await getToken(ctx);
  const base = ctx.config.resourceUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/data/v9.2${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Prefer: 'return=representation',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`D365 API ${res.status}: ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) return null;
  return res.json();
}

export const dynamicsConnector = {
  type: 'microsoft_dynamics',

  async connect(ctx) {
    if (!ctx.config?.aadTenantId || !ctx.config?.clientId || !ctx.config?.resourceUrl) {
      return { ok: false, detail: 'aadTenantId, clientId, clientSecret, resourceUrl required' };
    }
    try {
      await getToken(ctx);
      return { ok: true };
    } catch (e) {
      return { ok: false, detail: e.message };
    }
  },

  async disconnect(ctx) {
    _cache.delete(`${ctx.tenantId}:dynamics365`);
  },

  async push(ctx, event) {
    if (event.type === 'conversation.created' || event.type === 'ticket.created') {
      try {
        const p = event.payload ?? {};
        await d365Fetch(ctx, '/incidents', {
          method: 'POST',
          body: JSON.stringify({
            title: p.subject ?? `BlinkOne: ${event.type}`,
            description: p.description ?? JSON.stringify(p),
            prioritycode: 2,
            caseorigincode: 3,
          }),
        });
        return { ok: true, detail: 'incident created' };
      } catch (e) {
        return { ok: false, detail: e.message };
      }
    }
    return { ok: true, detail: 'event ignored' };
  },

  async pull() {
    return {};
  },

  async healthcheck(ctx) {
    try {
      await d365Fetch(ctx, '/WhoAmI');
      return { ok: true };
    } catch (e) {
      return { ok: false, detail: e.message };
    }
  },

  // ─── CRM lookup (TR-53) ────────────────────────────────────────────────────

  async lookupContact(ctx, { phone, email }) {
    const filter = email
      ? `emailaddress1 eq '${email}'`
      : `telephone1 eq '${phone}' or mobilephone eq '${phone}'`;
    try {
      const result = await d365Fetch(
        ctx,
        `/contacts?$filter=${encodeURIComponent(filter)}&$select=contactid,fullname,emailaddress1,telephone1,mobilephone&$top=1`,
      );
      const r = result?.value?.[0];
      if (!r) return null;
      return {
        id:    r.contactid,
        name:  r.fullname,
        email: r.emailaddress1,
        phone: r.telephone1 ?? r.mobilephone,
        source: 'microsoft_dynamics',
        sourceLabel: 'Dynamics 365',
      };
    } catch (e) {
      (ctx.log ?? console).warn?.(`dynamics365 lookupContact: ${e.message}`);
      return null;
    }
  },

  async createCase(ctx, { contactId, subject, description, priority = 2 }) {
    const body = { title: subject, description, prioritycode: priority, caseorigincode: 3 };
    if (contactId) body['customerid_contact@odata.bind'] = `/contacts(${contactId})`;
    const result = await d365Fetch(ctx, '/incidents', { method: 'POST', body: JSON.stringify(body) });
    return { caseId: result?.incidentid, source: 'microsoft_dynamics' };
  },

  async addNote(ctx, { caseId, note, agentName = 'Agent' }) {
    await d365Fetch(ctx, '/annotations', {
      method: 'POST',
      body: JSON.stringify({
        notetext: `[BlinkOne — ${agentName}] ${note}`,
        'objectid_incident@odata.bind': `/incidents(${caseId})`,
      }),
    });
  },

  async closeCase(ctx, { caseId, resolution }) {
    await d365Fetch(ctx, `/incidents(${caseId})/Microsoft.Dynamics.CRM.CloseIncident`, {
      method: 'POST',
      body: JSON.stringify({
        IncidentResolution: {
          incidentid: { incidentid: caseId },
          description: resolution,
          subject: 'Resolved via BlinkOne',
        },
        Status: -1,
      }),
    });
  },
};
