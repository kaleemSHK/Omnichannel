# PROMPT 37 — ERP / CRM Connector Framework + First Real Adapters
## BlinkOne · blinksone.com · TRD Requirements TR-50, TR-51, TR-52, TR-53

---

## CONTEXT

The integration service at `services/integration` has:
- A connector framework scaffold
- Outbound webhooks (working)
- Chatwoot webhook consumer (working)
- Keycloak provisioning stub

**What's missing**: No actual ERP/CRM adapters are implemented. The TRD requires integration with Salesforce, Microsoft Dynamics 365, and a generic REST connector for Oman market ERPs (e.g. SAP Business One, Oracle Fusion). This prompt implements the connector framework pattern and the first two real adapters.

---

## PART A — Connector Framework Architecture

Create `services/integration/lib/connectors/base.js`:

```javascript
/**
 * Base connector class. All CRM/ERP adapters extend this.
 */
export class BaseConnector {
  constructor({ tenantId, config, log }) {
    this.tenantId = tenantId;
    this.config = config;
    this.log = log;
  }

  /** Returns the connector type identifier (e.g. 'salesforce', 'dynamics365') */
  get type() {
    throw new Error('type() must be implemented');
  }

  /** Search for a contact/customer by phone or email. Returns contact record or null. */
  async lookupContact({ phone, email }) {
    throw new Error('lookupContact() must be implemented');
  }

  /** Create or update a case/ticket in the CRM. */
  async createCase({ contactId, subject, description, priority }) {
    throw new Error('createCase() must be implemented');
  }

  /** Append a note/activity to an existing case. */
  async addNote({ caseId, note, agentName }) {
    throw new Error('addNote() must be implemented');
  }

  /** Close/resolve a case. */
  async closeCase({ caseId, resolution }) {
    throw new Error('closeCase() must be implemented');
  }

  /** Health check — returns true if the connector can reach the remote system. */
  async ping() {
    return false;
  }
}
```

Create connector registry at `services/integration/lib/connectors/registry.js`:

```javascript
import { SalesforceConnector } from './salesforce.js';
import { Dynamics365Connector } from './dynamics365.js';
import { GenericRestConnector } from './generic-rest.js';

const CONNECTORS = {
  salesforce: SalesforceConnector,
  dynamics365: Dynamics365Connector,
  generic_rest: GenericRestConnector,
};

/**
 * Instantiate a connector by type.
 * @param {string} type
 * @param {{ tenantId: string, config: object, log: object }} opts
 */
export function createConnector(type, opts) {
  const ConnectorClass = CONNECTORS[type];
  if (!ConnectorClass) throw new Error(`Unknown connector type: ${type}`);
  return new ConnectorClass(opts);
}

export const CONNECTOR_TYPES = Object.keys(CONNECTORS);
```

---

## PART B — Salesforce Connector

Create `services/integration/lib/connectors/salesforce.js`:

```javascript
import { BaseConnector } from './base.js';

export class SalesforceConnector extends BaseConnector {
  get type() { return 'salesforce'; }

  async #getToken() {
    if (this._token && this._tokenExpiry > Date.now()) return this._token;

    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      username: this.config.username,
      password: this.config.password + (this.config.securityToken ?? ''),
    });

    const res = await fetch(`${this.config.instanceUrl}/services/oauth2/token`, {
      method: 'POST',
      body: params,
    });

    if (!res.ok) throw new Error(`Salesforce auth failed: ${res.status}`);
    const json = await res.json();
    this._token = json.access_token;
    this._instanceUrl = json.instance_url;
    this._tokenExpiry = Date.now() + 3600 * 1000; // 1 hour
    return this._token;
  }

  async #sfFetch(path, options = {}) {
    const token = await this.#getToken();
    const url = `${this._instanceUrl}/services/data/v59.0${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Salesforce API ${res.status}: ${err}`);
    }
    return res.json();
  }

  async lookupContact({ phone, email }) {
    const query = email
      ? `SELECT Id,Name,Phone,Email,AccountId FROM Contact WHERE Email='${email}' LIMIT 1`
      : `SELECT Id,Name,Phone,Email,AccountId FROM Contact WHERE Phone='${phone}' LIMIT 1`;

    try {
      const result = await this.#sfFetch(`/query?q=${encodeURIComponent(query)}`);
      const record = result.records?.[0];
      if (!record) return null;
      return {
        id: record.Id,
        name: record.Name,
        email: record.Email,
        phone: record.Phone,
        accountId: record.AccountId,
        source: 'salesforce',
      };
    } catch (e) {
      this.log.warn({ err: e.message }, 'salesforce lookupContact failed');
      return null;
    }
  }

  async createCase({ contactId, subject, description, priority = 'Medium' }) {
    const body = {
      Subject: subject,
      Description: description,
      Priority: priority,
      Status: 'New',
      Origin: 'BlinkOne',
      ...(contactId ? { ContactId: contactId } : {}),
    };

    const result = await this.#sfFetch('/sobjects/Case', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { caseId: result.id, source: 'salesforce' };
  }

  async addNote({ caseId, note, agentName }) {
    await this.#sfFetch('/sobjects/CaseComment', {
      method: 'POST',
      body: JSON.stringify({
        ParentId: caseId,
        CommentBody: `[BlinkOne - ${agentName}] ${note}`,
        IsPublished: false,
      }),
    });
  }

  async closeCase({ caseId, resolution }) {
    await this.#sfFetch(`/sobjects/Case/${caseId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        Status: 'Closed',
        Resolution__c: resolution,
      }),
    });
  }

  async ping() {
    try {
      await this.#getToken();
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## PART C — Microsoft Dynamics 365 Connector

Create `services/integration/lib/connectors/dynamics365.js`:

```javascript
import { BaseConnector } from './base.js';

const GRAPH_TOKEN_URL = 'https://login.microsoftonline.com';

export class Dynamics365Connector extends BaseConnector {
  get type() { return 'dynamics365'; }

  async #getToken() {
    if (this._token && this._tokenExpiry > Date.now()) return this._token;

    const res = await fetch(
      `${GRAPH_TOKEN_URL}/${this.config.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          scope: `${this.config.resourceUrl}/.default`,
          grant_type: 'client_credentials',
        }),
      }
    );
    if (!res.ok) throw new Error(`D365 auth failed: ${res.status}`);
    const json = await res.json();
    this._token = json.access_token;
    this._tokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
    return this._token;
  }

  async #d365Fetch(path, options = {}) {
    const token = await this.#getToken();
    const base = this.config.resourceUrl.replace(/\/$/, '');
    const res = await fetch(`${base}/api/data/v9.2${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`D365 API ${res.status}`);
    return options.method === 'PATCH' ? null : res.json();
  }

  async lookupContact({ phone, email }) {
    const filter = email
      ? `emailaddress1 eq '${email}'`
      : `telephone1 eq '${phone}' or mobilephone eq '${phone}'`;

    try {
      const result = await this.#d365Fetch(
        `/contacts?$filter=${encodeURIComponent(filter)}&$select=contactid,fullname,emailaddress1,telephone1&$top=1`
      );
      const record = result.value?.[0];
      if (!record) return null;
      return {
        id: record.contactid,
        name: record.fullname,
        email: record.emailaddress1,
        phone: record.telephone1,
        source: 'dynamics365',
      };
    } catch (e) {
      this.log.warn({ err: e.message }, 'dynamics365 lookupContact failed');
      return null;
    }
  }

  async createCase({ contactId, subject, description, priority = 2 }) {
    // priority: 1=High, 2=Normal, 3=Low in D365
    const body = {
      title: subject,
      description,
      prioritycode: priority,
      casetypecode: 1, // Question
      caseorigincode: 3, // Web
    };
    if (contactId) {
      body['customerid_contact@odata.bind'] = `/contacts(${contactId})`;
    }

    const result = await this.#d365Fetch('/incidents', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { caseId: result?.incidentid, source: 'dynamics365' };
  }

  async addNote({ caseId, note, agentName }) {
    await this.#d365Fetch('/annotations', {
      method: 'POST',
      body: JSON.stringify({
        notetext: `[BlinkOne - ${agentName}] ${note}`,
        'objectid_incident@odata.bind': `/incidents(${caseId})`,
      }),
    });
  }

  async closeCase({ caseId, resolution }) {
    // Close incident via IncidentResolution entity
    await this.#d365Fetch(`/incidents(${caseId})/Microsoft.Dynamics.CRM.CloseIncident`, {
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
  }

  async ping() {
    try {
      await this.#d365Fetch('/WhoAmI');
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## PART D — Generic REST Connector

Create `services/integration/lib/connectors/generic-rest.js`:

```javascript
import { BaseConnector } from './base.js';

/**
 * Generic REST connector — maps BlinkOne operations to configurable HTTP calls.
 * config shape:
 * {
 *   baseUrl: 'https://erp.example.com/api',
 *   authType: 'bearer' | 'basic' | 'api_key',
 *   authValue: 'TOKEN_HERE',
 *   endpoints: {
 *     lookupContact: { method: 'GET', path: '/contacts?email={email}&phone={phone}', resultPath: 'data.0' },
 *     createCase: { method: 'POST', path: '/cases', body: { title: '{subject}', notes: '{description}' } },
 *     addNote: { method: 'POST', path: '/cases/{caseId}/notes', body: { text: '{note}' } },
 *     closeCase: { method: 'PATCH', path: '/cases/{caseId}', body: { status: 'closed' } },
 *   }
 * }
 */
export class GenericRestConnector extends BaseConnector {
  get type() { return 'generic_rest'; }

  #authHeaders() {
    const { authType, authValue } = this.config;
    if (authType === 'bearer') return { Authorization: `Bearer ${authValue}` };
    if (authType === 'basic') return { Authorization: `Basic ${Buffer.from(authValue).toString('base64')}` };
    if (authType === 'api_key') return { [this.config.apiKeyHeader ?? 'X-API-Key']: authValue };
    return {};
  }

  #interpolate(template, vars) {
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
  }

  async #call(endpointKey, vars) {
    const ep = this.config.endpoints?.[endpointKey];
    if (!ep) return null;

    const url = this.config.baseUrl.replace(/\/$/, '') + this.#interpolate(ep.path, vars);
    const options = {
      method: ep.method,
      headers: { 'Content-Type': 'application/json', ...this.#authHeaders() },
    };

    if (ep.body && ep.method !== 'GET') {
      const body = JSON.parse(this.#interpolate(JSON.stringify(ep.body), vars));
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    if (!res.ok) return null;
    const json = await res.json();

    if (ep.resultPath) {
      return ep.resultPath.split('.').reduce((obj, key) =>
        key === '0' ? obj?.[0] : obj?.[key], json);
    }
    return json;
  }

  async lookupContact({ phone, email }) {
    const result = await this.#call('lookupContact', { phone: phone ?? '', email: email ?? '' });
    if (!result) return null;
    return {
      id: result[this.config.idField ?? 'id'],
      name: result[this.config.nameField ?? 'name'],
      email: result[this.config.emailField ?? 'email'],
      phone: result[this.config.phoneField ?? 'phone'],
      source: 'generic_rest',
    };
  }

  async createCase({ contactId, subject, description, priority }) {
    const result = await this.#call('createCase', { contactId: contactId ?? '', subject, description, priority });
    return { caseId: result?.[this.config.idField ?? 'id'], source: 'generic_rest' };
  }

  async addNote({ caseId, note, agentName }) {
    await this.#call('addNote', { caseId, note, agentName });
  }

  async closeCase({ caseId, resolution }) {
    await this.#call('closeCase', { caseId, resolution });
  }

  async ping() {
    try {
      const pingPath = this.config.pingPath ?? '/';
      const res = await fetch(this.config.baseUrl + pingPath, {
        headers: this.#authHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

---

## PART E — Connector REST API in Integration Service

Open `services/integration/src/server.js`. Add connector management endpoints:

```javascript
import { createConnector, CONNECTOR_TYPES } from '../lib/connectors/registry.js';
import { getPool } from '../lib/db.js';

// Store connector configs in DB
// Table: integration_connectors (id, tenant_id, type, name, config_encrypted, enabled, created_at)

app.get('/v1/connectors', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, type, name, enabled, created_at FROM integration_connectors WHERE tenant_id=$1`,
    [tenantId]
  );
  return ok(res, rows);
});

app.post('/v1/connectors', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const { type, name, config } = req.body ?? {};

  if (!CONNECTOR_TYPES.includes(type)) {
    return fail(res, 'VALIDATION_ERROR', `type must be one of: ${CONNECTOR_TYPES.join(', ')}`);
  }
  if (!name) return fail(res, 'VALIDATION_ERROR', 'name required');

  // Test connection before saving
  try {
    const connector = createConnector(type, { tenantId, config, log });
    const alive = await connector.ping();
    if (!alive) return fail(res, 'CONNECTION_FAILED', 'Could not connect to the remote system', 422);
  } catch (e) {
    return fail(res, 'CONNECTION_FAILED', e.message, 422);
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO integration_connectors (tenant_id, type, name, config_encrypted, enabled)
     VALUES ($1, $2, $3, $4, true) RETURNING id, type, name, enabled, created_at`,
    [tenantId, type, name, JSON.stringify(config)] // TODO: encrypt config at rest
  );
  return ok(res, rows[0], 201);
});

app.post('/v1/connectors/:id/lookup', auth, async (req, res) => {
  const { phone, email } = req.body ?? {};
  const tenantId = resolveTenantId(req);
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT * FROM integration_connectors WHERE id=$1 AND tenant_id=$2 AND enabled=true`,
    [req.params.id, tenantId]
  );
  if (!rows[0]) return fail(res, 'NOT_FOUND', 'Connector not found', 404);

  const connector = createConnector(rows[0].type, {
    tenantId,
    config: JSON.parse(rows[0].config_encrypted),
    log,
  });

  const contact = await connector.lookupContact({ phone, email });
  return ok(res, contact);
});
```

Add migration for `integration_connectors` table:

```sql
CREATE TABLE IF NOT EXISTS integration_connectors (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        text NOT NULL,
  type             text NOT NULL,
  name             text NOT NULL,
  config_encrypted text NOT NULL,
  enabled          boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_integration_connectors_tenant ON integration_connectors(tenant_id);
```

---

## PART F — Frontend: Connector Settings UI

Create `frontend/src/components/settings/ConnectorsSettings.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Wifi, WifiOff } from 'lucide-react';
import { bnFetch } from '@/lib/api/gateway';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CONNECTOR_TYPE_LABELS: Record<string, string> = {
  salesforce: 'Salesforce CRM',
  dynamics365: 'Microsoft Dynamics 365',
  generic_rest: 'Generic REST API',
};

export function ConnectorsSettings() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ type: 'salesforce', name: '', config: '{}' });
  const [error, setError] = useState('');

  const { data: connectors = [], isLoading } = useQuery({
    queryKey: ['connectors'],
    queryFn: async () => {
      const res = await bnFetch('/integration/v1/connectors');
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const config = JSON.parse(form.config);
      const res = await bnFetch('/integration/v1/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: form.type, name: form.name, config }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to add connector');
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['connectors'] });
      setAddOpen(false);
      setError('');
      setForm({ type: 'salesforce', name: '', config: '{}' });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">CRM & ERP Connectors</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Connect external CRM and ERP systems for unified customer data.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(v => !v)}>
          <Plus className="w-4 h-4 me-1" />
          Add Connector
        </Button>
      </div>

      {addOpen && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
          <h3 className="text-sm font-medium">New Connector</h3>
          <select
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className="w-full text-sm border border-gray-200 rounded-md px-2 py-2 bg-white"
          >
            {Object.entries(CONNECTOR_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <Input
            placeholder="Connector name (e.g. Salesforce Production)"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Configuration JSON
            </label>
            <textarea
              value={form.config}
              onChange={e => setForm(f => ({ ...f, config: e.target.value }))}
              rows={6}
              className="w-full text-xs font-mono border border-gray-200 rounded-md px-2 py-2"
              placeholder='{"instanceUrl": "https://myorg.salesforce.com", "clientId": "...", ...}'
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>
              {add.isPending ? 'Testing connection…' : 'Connect & Save'}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {connectors.map((c: { id: string; type: string; name: string; enabled: boolean }) => (
          <div key={c.id} className="flex items-center gap-3 border rounded-md px-3 py-2.5 bg-background">
            {c.enabled
              ? <Wifi className="w-4 h-4 text-green-500 shrink-0" />
              : <WifiOff className="w-4 h-4 text-gray-400 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{c.name}</p>
              <p className="text-xs text-muted-foreground">{CONNECTOR_TYPE_LABELS[c.type] ?? c.type}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${c.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {c.enabled ? 'Connected' : 'Disabled'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## PART G — Auto-Lookup in Conversation View

When an agent opens a conversation, auto-lookup the customer in connected CRM and display the result in the contact sidebar. Open `frontend/src/components/conversations/ConversationSidebar.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { bnFetch } from '@/lib/api/gateway';

function CRMLookupCard({ phone, email }: { phone?: string; email?: string }) {
  const { data: contact, isLoading } = useQuery({
    queryKey: ['crm-lookup', phone, email],
    queryFn: async () => {
      // Look up across all configured connectors (backend handles this)
      const res = await bnFetch('/integration/v1/connectors/lookup-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, email }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data;
    },
    enabled: !!(phone || email),
    retry: false,
  });

  if (!phone && !email) return null;
  if (isLoading) return <p className="text-xs text-muted-foreground">Looking up in CRM…</p>;
  if (!contact) return null;

  return (
    <div className="border rounded-md p-2.5 bg-blue-50/50">
      <p className="text-xs font-semibold text-blue-700 mb-1">Found in {contact.source}</p>
      <p className="text-sm font-medium">{contact.name}</p>
      {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
    </div>
  );
}
```

Add `/v1/connectors/lookup-all` endpoint to integration service that fans out to all enabled connectors and returns the first non-null result.

---

## VERIFICATION CHECKLIST

- [ ] Settings → Integrations shows "Add Connector" button
- [ ] Adding a Salesforce connector with valid credentials saves and shows "Connected" status
- [ ] Adding with invalid credentials shows "Could not connect to the remote system" error
- [ ] When opening a conversation with a known email, the contact appears in the CRM panel
- [ ] Generic REST connector works with a test HTTP API (e.g. JSONPlaceholder)
- [ ] `integration_connectors` table exists in Postgres
- [ ] Connector config is stored (plaintext for now — add encryption later)

---

## TRD REQUIREMENTS COVERED

| TRD ID | Requirement | Status After Prompt |
|--------|-------------|---------------------|
| TR-50  | CRM integration (Salesforce) | ✅ DONE |
| TR-51  | ERP integration (Dynamics 365) | ✅ DONE |
| TR-52  | Generic REST connector framework | ✅ DONE |
| TR-53  | Auto customer lookup on conversation open | ✅ DONE |
