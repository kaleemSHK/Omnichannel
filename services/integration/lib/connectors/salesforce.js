/**
 * Salesforce CRM connector — OAuth2 username/password flow, REST API v59.
 *
 * ctx.config shape:
 *   instanceUrl     : 'https://myorg.salesforce.com'
 *   clientId        : OAuth2 connected-app client ID
 *   clientSecret    : OAuth2 connected-app client secret
 *   username        : Salesforce user login
 *   password        : Salesforce user password
 *   securityToken   : (optional) appended to password for IP-restricted orgs
 */

// Module-level token cache — keyed by `${tenantId}:salesforce` to avoid per-request auth
const _cache = new Map();

function cacheGet(key) {
  const entry = _cache.get(key);
  if (entry && entry.expiry > Date.now()) return entry;
  _cache.delete(key);
  return null;
}

async function getToken(ctx) {
  const cacheKey = `${ctx.tenantId}:salesforce`;
  const cached = cacheGet(cacheKey);
  if (cached) return { token: cached.token, instanceUrl: cached.instanceUrl };

  const cfg = ctx.config;
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    username: cfg.username,
    password: cfg.password + (cfg.securityToken ?? ''),
  });

  const res = await fetch(`${cfg.instanceUrl}/services/oauth2/token`, {
    method: 'POST',
    body: params,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Salesforce OAuth failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  _cache.set(cacheKey, {
    token: json.access_token,
    instanceUrl: json.instance_url,
    expiry: Date.now() + 3_500_000, // 58 min (Salesforce tokens last ~1h)
  });
  return { token: json.access_token, instanceUrl: json.instance_url };
}

async function sfFetch(ctx, path, options = {}) {
  const { token, instanceUrl } = await getToken(ctx);
  const res = await fetch(`${instanceUrl}/services/data/v59.0${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Salesforce API ${res.status}: ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const salesforceConnector = {
  type: 'salesforce',

  async connect(ctx) {
    if (!ctx.config?.instanceUrl || !ctx.config?.clientId) {
      return { ok: false, detail: 'instanceUrl, clientId, clientSecret, username, password required' };
    }
    try {
      await getToken(ctx);
      return { ok: true };
    } catch (e) {
      return { ok: false, detail: e.message };
    }
  },

  async disconnect(ctx) {
    _cache.delete(`${ctx.tenantId}:salesforce`);
  },

  /** Push a BlinkOne event to Salesforce (e.g. create Case on conversation.created). */
  async push(ctx, event) {
    if (event.type === 'conversation.created' || event.type === 'ticket.created') {
      try {
        const payload = event.payload ?? {};
        const result = await sfFetch(ctx, '/sobjects/Case', {
          method: 'POST',
          body: JSON.stringify({
            Subject: payload.subject ?? `BlinkOne: ${event.type}`,
            Description: payload.description ?? JSON.stringify(payload),
            Status: 'New',
            Origin: 'BlinkOne',
            Priority: 'Medium',
          }),
        });
        return { ok: true, detail: `Case ${result?.id}` };
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
      await getToken(ctx);
      return { ok: true };
    } catch (e) {
      return { ok: false, detail: e.message };
    }
  },

  // ─── CRM lookup methods (TR-53) ────────────────────────────────────────────

  /** Lookup a contact in Salesforce by phone or email. Returns normalised record or null. */
  async lookupContact(ctx, { phone, email }) {
    const field = email ? `Email='${email}'` : `Phone='${phone}' OR MobilePhone='${phone}'`;
    const q = `SELECT Id,Name,Phone,MobilePhone,Email,AccountId FROM Contact WHERE ${field} LIMIT 1`;
    try {
      const result = await sfFetch(ctx, `/query?q=${encodeURIComponent(q)}`);
      const r = result?.records?.[0];
      if (!r) return null;
      return {
        id:    r.Id,
        name:  r.Name,
        email: r.Email,
        phone: r.Phone ?? r.MobilePhone,
        accountId: r.AccountId,
        source: 'salesforce',
        sourceLabel: 'Salesforce',
      };
    } catch (e) {
      (ctx.log ?? console).warn?.(`salesforce lookupContact: ${e.message}`);
      return null;
    }
  },

  /** Create a Case in Salesforce and return { caseId, source }. */
  async createCase(ctx, { contactId, subject, description, priority = 'Medium' }) {
    const body = {
      Subject: subject,
      Description: description,
      Priority: priority,
      Status: 'New',
      Origin: 'BlinkOne',
      ...(contactId ? { ContactId: contactId } : {}),
    };
    const result = await sfFetch(ctx, '/sobjects/Case', { method: 'POST', body: JSON.stringify(body) });
    return { caseId: result?.id, source: 'salesforce' };
  },

  /** Append a CaseComment to an existing case. */
  async addNote(ctx, { caseId, note, agentName = 'Agent' }) {
    await sfFetch(ctx, '/sobjects/CaseComment', {
      method: 'POST',
      body: JSON.stringify({
        ParentId: caseId,
        CommentBody: `[BlinkOne — ${agentName}] ${note}`,
        IsPublished: false,
      }),
    });
  },

  /** Close/resolve a case. */
  async closeCase(ctx, { caseId, resolution }) {
    await sfFetch(ctx, `/sobjects/Case/${caseId}`, {
      method: 'PATCH',
      body: JSON.stringify({ Status: 'Closed', Description: resolution }),
    });
  },
};
