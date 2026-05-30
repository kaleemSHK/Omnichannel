# PROMPT 28 — Tickets Service: Postgres Activation + Custom Fields UI
## BlinkOne · blinksone.com · TRD Requirements TR-22, TR-25, TR-26, TR-28

---

## CONTEXT

The `services/tickets` service already has:
- A complete Postgres repository at `services/tickets/lib/ticket-repo.js`
- Migration SQL at `services/tickets/db/001_tickets.sql` (tickets, ticket_events, ticket_fields)
- Row-level security at `services/tickets/db/003_rls.sql`
- A migration runner at `services/tickets/lib/db.js`

**The problem**: In `docker-compose.yml`, the `tickets` service is missing `BLINKONE_DATABASE_URL`. Without it, `dbEnabled()` returns false and the service uses flat-file fallback. No data persists across restarts.

This prompt activates Postgres for tickets, ensures migrations run, and adds the missing custom fields UI.

---

## PART A — Wire Postgres to the Tickets Service

### Step 1: Add `BLINKONE_DATABASE_URL` to docker-compose.yml

Open `docker-compose.yml` and find the `tickets:` service block. Add this environment variable alongside the existing ones:

```yaml
  tickets:
    build: ./services/tickets
    environment:
      PORT: "8791"
      TOKEN: ${GATEWAY_TOKEN}
      DATA_DIR: /data/tickets
      BLINKONE_DATABASE_URL: postgres://blinkone_app:${APP_DB_PASSWORD:-blinkone_app_dev}@postgres_app:5432/blinkone_app
      TENANT_SERVICE_URL: http://tenant:8802
      LOG_LEVEL: info
    depends_on:
      postgres_app:
        condition: service_healthy
    volumes:
      - tickets-data:/data/tickets
    networks:
      - blinkone-net
    restart: unless-stopped
```

Also add the same `BLINKONE_DATABASE_URL` to the `sla:`, `escalation:`, and `routing:` services in docker-compose.yml — they all use the same `dbEnabled()` check.

### Step 2: Verify the migration SQL covers custom fields

Open `services/tickets/db/001_tickets.sql`. Confirm these tables exist:
- `tickets` — with `tenant_id`, `status`, `priority`, `subject`, `description`, `assignee_id`, `contact_id`, `conversation_id`
- `ticket_events` — timeline/audit log
- `ticket_fields` — custom field definitions (field_key, field_type, options JSONB)

If `ticket_fields` is missing, add it to the end of `001_tickets.sql`:

```sql
CREATE TABLE IF NOT EXISTS ticket_fields (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  field_key   text NOT NULL,
  label       text NOT NULL,
  field_type  text NOT NULL CHECK (field_type IN ('text','number','boolean','select','date')),
  options     jsonb,
  required    boolean NOT NULL DEFAULT false,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_ticket_fields_tenant ON ticket_fields(tenant_id);
```

### Step 3: Add custom fields REST endpoints to the tickets service

Open `services/tickets/src/server.js` (or wherever routes are defined). Add after existing ticket routes:

```javascript
// ─── Custom Fields ────────────────────────────────────────────────────────────
app.get('/v1/fields', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM ticket_fields WHERE tenant_id = $1 ORDER BY sort_order, created_at`,
      [tenantId]
    );
    return ok(res, rows);
  } catch (e) {
    log.error({ err: e.message }, 'list fields');
    return fail(res, 'INTERNAL_ERROR', 'Failed to list fields', 500);
  }
});

app.post('/v1/fields', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const { field_key, label, field_type, options, required, sort_order } = req.body ?? {};
  if (!field_key || !label || !field_type) {
    return fail(res, 'VALIDATION_ERROR', 'field_key, label, and field_type are required');
  }
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO ticket_fields (tenant_id, field_key, label, field_type, options, required, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, field_key, label, field_type, options ?? null, required ?? false, sort_order ?? 0]
    );
    return ok(res, rows[0], 201);
  } catch (e) {
    if (e.code === '23505') return fail(res, 'CONFLICT', 'Field key already exists', 409);
    log.error({ err: e.message }, 'create field');
    return fail(res, 'INTERNAL_ERROR', 'Failed to create field', 500);
  }
});

app.delete('/v1/fields/:id', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const pool = getPool();
  await pool.query(`DELETE FROM ticket_fields WHERE id=$1 AND tenant_id=$2`, [req.params.id, tenantId]);
  return ok(res, { deleted: true });
});
```

---

## PART B — Frontend: Custom Fields API Client

Create `frontend/src/lib/api/ticketFields.ts`:

```typescript
import { bnFetch } from './gateway';

export interface TicketField {
  id: string;
  field_key: string;
  label: string;
  field_type: 'text' | 'number' | 'boolean' | 'select' | 'date';
  options?: { value: string; label: string }[];
  required: boolean;
  sort_order: number;
}

export async function listTicketFields(): Promise<TicketField[]> {
  const res = await bnFetch('/tickets/v1/fields');
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

export async function createTicketField(
  payload: Omit<TicketField, 'id'>
): Promise<TicketField> {
  const res = await bnFetch('/tickets/v1/fields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to create field');
  return json.data;
}

export async function deleteTicketField(id: string): Promise<void> {
  await bnFetch(`/tickets/v1/fields/${id}`, { method: 'DELETE' });
}
```

---

## PART C — Frontend: Custom Fields Admin UI

Create `frontend/src/components/settings/TicketFieldsSettings.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { listTicketFields, createTicketField, deleteTicketField, type TicketField } from '@/lib/api/ticketFields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const FIELD_TYPES = ['text', 'number', 'boolean', 'select', 'date'] as const;

export function TicketFieldsSettings() {
  const qc = useQueryClient();
  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['ticket-fields'],
    queryFn: listTicketFields,
  });

  const [form, setForm] = useState({
    field_key: '',
    label: '',
    field_type: 'text' as TicketField['field_type'],
    required: false,
  });
  const [error, setError] = useState('');

  const create = useMutation({
    mutationFn: () =>
      createTicketField({ ...form, sort_order: fields.length }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-fields'] });
      setForm({ field_key: '', label: '', field_type: 'text', required: false });
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: deleteTicketField,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-fields'] }),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold">Custom Ticket Fields</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add custom fields that appear on every ticket form.
        </p>
      </div>

      {/* Add field form */}
      <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
        <h3 className="text-sm font-medium">Add new field</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input
            placeholder="Field key (e.g. order_id)"
            value={form.field_key}
            onChange={e =>
              setForm(f => ({ ...f, field_key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))
            }
          />
          <Input
            placeholder="Display label"
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={form.field_type}
            onChange={e => setForm(f => ({ ...f, field_type: e.target.value as TicketField['field_type'] }))}
            className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
          >
            {FIELD_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.required}
              onChange={e => setForm(f => ({ ...f, required: e.target.checked }))}
            />
            Required
          </label>
          <Button
            size="sm"
            onClick={() => create.mutate()}
            disabled={!form.field_key || !form.label || create.isPending}
            className="ms-auto"
          >
            <Plus className="w-4 h-4 me-1" />
            Add Field
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {/* Existing fields list */}
      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {fields.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground">No custom fields yet.</p>
        )}
        {fields.map(f => (
          <div
            key={f.id}
            className="flex items-center justify-between border rounded-md px-3 py-2 bg-background"
          >
            <div>
              <span className="text-sm font-medium">{f.label}</span>
              <span className="text-xs text-muted-foreground ms-2">
                {f.field_key} · {f.field_type}
                {f.required && ' · required'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => remove.mutate(f.id)}
              className="text-muted-foreground hover:text-destructive p-1 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Register in settings page

Open `frontend/src/app/(dashboard)/settings/page.tsx` (or wherever TicketSettings tab lives). Import and render `<TicketFieldsSettings />` under a "Custom Fields" tab within the Tickets settings section.

---

## PART D — Wire Custom Fields into the Ticket Create/Edit Form

Open `frontend/src/components/tickets/TicketForm.tsx` (create if missing).

Fetch fields with `useQuery(['ticket-fields'], listTicketFields)`. For each field, render the appropriate input below the standard fields:

```tsx
{fields.map(field => (
  <div key={field.field_key}>
    <label className="block text-sm font-medium mb-1">
      {field.label}{field.required && ' *'}
    </label>
    {field.field_type === 'boolean' ? (
      <input
        type="checkbox"
        checked={!!customFieldValues[field.field_key]}
        onChange={e =>
          setCustomFieldValues(v => ({ ...v, [field.field_key]: e.target.checked }))
        }
      />
    ) : field.field_type === 'select' ? (
      <select
        value={customFieldValues[field.field_key] ?? ''}
        onChange={e =>
          setCustomFieldValues(v => ({ ...v, [field.field_key]: e.target.value }))
        }
        className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5"
      >
        <option value="">Select…</option>
        {(field.options ?? []).map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    ) : (
      <input
        type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
        value={customFieldValues[field.field_key] ?? ''}
        onChange={e =>
          setCustomFieldValues(v => ({ ...v, [field.field_key]: e.target.value }))
        }
        className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5"
      />
    )}
  </div>
))}
```

Pass `customFieldValues` as `custom_fields` in the ticket create/update payload.

---

## PART E — Server Restart Commands

After making the code changes above, run on the server:

```bash
ssh root@204.168.137.104

cd /opt/blinkone

# Pull latest code
git pull origin main

# Restart tickets service (applies env var + runs migrations on startup)
docker compose restart tickets sla escalation routing

# Watch tickets logs to confirm Postgres migration ran
docker compose logs -f --tail=40 tickets

# Expected log lines:
# "running migrations..."
# "migrations complete"
# "tickets service listening on :8791"

# Confirm no flat-file fallback
docker compose exec tickets env | grep BLINKONE_DATABASE_URL
```

---

## VERIFICATION CHECKLIST

- [ ] `docker compose logs tickets` shows "migrations complete" not "using file store"
- [ ] `curl -H "Authorization: Bearer $GATEWAY_TOKEN" http://localhost:8791/v1/tickets` returns JSON array (not error)
- [ ] Creating a ticket in the BlinkOne UI persists after `docker compose restart tickets`
- [ ] Custom fields appear in Settings → Tickets → Custom Fields
- [ ] Custom fields appear in the ticket create form

---

## TRD REQUIREMENTS COVERED

| TRD ID | Requirement | Status After Prompt |
|--------|-------------|---------------------|
| TR-22  | Ticket management with full persistence | ✅ DONE |
| TR-25  | Custom ticket fields | ✅ DONE |
| TR-26  | Ticket field types (text/select/date/boolean) | ✅ DONE |
| TR-28  | Department routing via ticket queue assignment | PARTIAL (queue field on ticket) |
