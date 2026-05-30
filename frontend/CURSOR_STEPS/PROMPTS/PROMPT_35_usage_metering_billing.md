# PROMPT 35 — Usage Metering: Voice Minutes + Messages → Billing
## BlinkOne · blinksone.com · TRD Requirements TR-44, TR-45, TR-46, TR-47

---

## CONTEXT

The billing service at `services/billing` has:
- Plans, subscriptions, invoices — all implemented
- Usage events endpoint: `POST /v1/usage` — accepts `{ metricKey, quantity, unitCost, metadata }`
- Currency: OMR, VAT 5%

The calls service at `services/calls` tracks call duration. The AI service tracks LLM tokens.
But **nothing is currently emitting usage events to the billing service** — voice minutes, messages, and AI tokens are unbilled.

---

## PART A — Emit Voice Minute Usage from Calls Service

Open `services/calls/src/server.js` (or the call completion handler). Find where a call is marked as completed/ended. After saving the call record, emit usage:

```javascript
import { emitUsage } from '../lib/billing-client.js';

// In the call completion handler (after call ends):
async function onCallCompleted({ callId, tenantId, durationSec, direction, agentId }) {
  // Save call record (existing logic)
  await saveCallRecord({ callId, tenantId, durationSec, direction, agentId });

  // Emit voice minutes to billing
  const voiceMinutes = Math.ceil(durationSec / 60); // round up to nearest minute
  await emitUsage({
    tenantId,
    metricKey: 'voice_minutes',
    quantity: voiceMinutes,
    unitCost: 0.015, // OMR 0.015 per minute (adjust to your pricing)
    metadata: { callId, direction, agentId },
  });
}
```

Create `services/calls/lib/billing-client.js`:

```javascript
const BILLING_URL = process.env.BILLING_SERVICE_URL || 'http://billing:8794';
const TOKEN = (process.env.TOKEN || '').trim();

/**
 * Emit a usage event to the billing service.
 */
export async function emitUsage({ tenantId, metricKey, quantity, unitCost, metadata }) {
  try {
    const res = await fetch(`${BILLING_URL}/v1/usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({ metricKey, quantity, unitCost, metadata }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn(`[billing-client] usage emit failed: ${res.status} ${err}`);
    }
  } catch (e) {
    // Non-blocking — billing failure should not break call flow
    console.warn('[billing-client] usage emit error:', e.message);
  }
}
```

Add the same `billing-client.js` pattern to:
- `services/ai` — emit `ai_tokens` usage after each LLM call
- `services/recording` — emit `recording_minutes` after each upload
- `services/whatsapp-calls` — emit `whatsapp_messages` per outbound message

---

## PART B — Emit Message Usage from Chatwoot Webhook

The integration service (`services/integration`) already consumes Chatwoot webhooks. Open `services/integration/src/server.js` and find the webhook handler. Add message counting:

```javascript
import { emitUsage } from '../lib/billing-client.js';

// In the Chatwoot webhook handler:
app.post('/v1/webhooks/chatwoot', async (req, res) => {
  const event = req.body;
  const tenantId = resolveTenantId(req);

  // Existing event handling...

  // Count outbound agent messages for billing
  if (event.event === 'message_created' && event.message_type === 'outgoing') {
    const channel = event.inbox?.channel_type ?? 'unknown';
    const metricKey = channel === 'Channel::Whatsapp' ? 'whatsapp_messages' : 'chat_messages';

    await emitUsage({
      tenantId,
      metricKey,
      quantity: 1,
      unitCost: metricKey === 'whatsapp_messages' ? 0.005 : 0.001, // OMR
      metadata: {
        conversationId: event.conversation?.id,
        inboxId: event.inbox?.id,
        channel,
      },
    });
  }

  return ok(res, { received: true });
});
```

---

## PART C — AI Token Usage Metering

Open `services/ai/src/server.js`. After each LLM call, emit token usage. Find the `suggestReply`, `classifyConversation`, `summarize`, `queryRAG` handlers. Add after each completion:

```javascript
// After openai.chat.completions.create():
const usage = completion.usage;
if (usage) {
  await emitUsage({
    tenantId,
    metricKey: 'ai_tokens',
    quantity: usage.total_tokens,
    unitCost: 0.00001, // OMR per token (gpt-4o-mini pricing)
    metadata: {
      model: completion.model,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      endpoint: req.path,
    },
  });
}
```

The AI service already has a daily quota check — this makes it accurate.

---

## PART D — Billing Service: Usage Aggregation Endpoint

Open `services/billing/src/server.js`. Add an aggregation endpoint for the frontend dashboard:

```javascript
// GET /v1/usage/summary — usage by metric for current billing period
app.get('/v1/usage/summary', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const pool = getPool();

  // Get current billing period start
  const { rows: [sub] } = await pool.query(
    `SELECT billing_period_start FROM subscriptions WHERE tenant_id=$1 AND status='active' LIMIT 1`,
    [tenantId]
  );
  const periodStart = sub?.billing_period_start ?? new Date(new Date().setDate(1)).toISOString();

  const { rows } = await pool.query(
    `SELECT
       metric_key,
       SUM(quantity)::int AS total_quantity,
       SUM(quantity * unit_cost)::numeric(12,3) AS total_cost
     FROM usage_events
     WHERE tenant_id=$1 AND created_at >= $2
     GROUP BY metric_key
     ORDER BY total_cost DESC`,
    [tenantId, periodStart]
  );

  return ok(res, {
    period_start: periodStart,
    metrics: rows,
    total_cost_omr: rows.reduce((sum, r) => sum + parseFloat(r.total_cost), 0).toFixed(3),
  });
});
```

Ensure the `usage_events` table exists in billing migrations:

```sql
CREATE TABLE IF NOT EXISTS usage_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  metric_key  text NOT NULL,
  quantity    numeric NOT NULL,
  unit_cost   numeric(10,6) NOT NULL DEFAULT 0,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_metric
  ON usage_events(tenant_id, metric_key, created_at);
```

---

## PART E — Frontend: Usage Dashboard in Billing Settings

Create `frontend/src/components/settings/UsageDashboard.tsx`:

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { bnFetch } from '@/lib/api/gateway';

interface MetricRow {
  metric_key: string;
  total_quantity: number;
  total_cost: string;
}

const METRIC_LABELS: Record<string, string> = {
  voice_minutes: 'Voice Minutes',
  chat_messages: 'Chat Messages',
  whatsapp_messages: 'WhatsApp Messages',
  ai_tokens: 'AI Tokens',
  recording_minutes: 'Recording Storage (min)',
};

export function UsageDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['usage-summary'],
    queryFn: async () => {
      const res = await bnFetch('/billing/v1/usage/summary');
      if (!res.ok) return null;
      const json = await res.json();
      return json.data as { period_start: string; metrics: MetricRow[]; total_cost_omr: string };
    },
    refetchInterval: 60000,
  });

  const periodStart = data?.period_start
    ? new Date(data.period_start).toLocaleDateString()
    : '—';

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold">Usage This Billing Period</h2>
        <p className="text-sm text-muted-foreground mt-1">From {periodStart}</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading usage…</p>}

      {data && (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-start px-4 py-2 font-medium text-muted-foreground">Metric</th>
                  <th className="text-end px-4 py-2 font-medium text-muted-foreground">Quantity</th>
                  <th className="text-end px-4 py-2 font-medium text-muted-foreground">Cost (OMR)</th>
                </tr>
              </thead>
              <tbody>
                {data.metrics.map(m => (
                  <tr key={m.metric_key} className="border-t">
                    <td className="px-4 py-2">
                      {METRIC_LABELS[m.metric_key] ?? m.metric_key}
                    </td>
                    <td className="px-4 py-2 text-end tabular-nums">
                      {m.total_quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-end tabular-nums">
                      {parseFloat(m.total_cost).toFixed(3)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t font-semibold bg-muted/20">
                  <td className="px-4 py-2">Total</td>
                  <td />
                  <td className="px-4 py-2 text-end tabular-nums">
                    {parseFloat(data.total_cost_omr).toFixed(3)} OMR
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            * Prices exclusive of VAT (5% applied on invoice)
          </p>
        </>
      )}
    </div>
  );
}
```

Register `<UsageDashboard />` in Settings → Billing tab.

---

## PART F — Add Billing Route to Gateway

Open `services/gateway/src/server.js`. Add proxy for billing service if missing:

```javascript
app.use('/billing', createProxyMiddleware({
  target: process.env.BILLING_SERVICE_URL || 'http://billing:8794',
  changeOrigin: true,
  pathRewrite: { '^/billing': '' },
}));
```

---

## PART G — docker-compose env wiring

Ensure each service that emits usage has `BILLING_SERVICE_URL` and `TOKEN`:

```yaml
# In calls, ai, recording, integration services:
BILLING_SERVICE_URL: http://billing:8794
TOKEN: ${GATEWAY_TOKEN}
```

---

## VERIFICATION CHECKLIST

- [ ] After making a test call (any duration), check: `curl -H "Authorization: Bearer $TOKEN" http://localhost:8794/v1/usage/summary` — shows `voice_minutes` with quantity > 0
- [ ] After sending a message via BlinkOne, `chat_messages` metric increments
- [ ] After an AI operation (suggest reply), `ai_tokens` metric increments
- [ ] Usage dashboard in Settings → Billing shows real data
- [ ] Total cost OMR calculation is correct (quantity × unit_cost)
- [ ] Usage emit failure in calls service does NOT break the call completion (non-blocking)
- [ ] `usage_events` table exists in Postgres: `docker compose exec postgres_app psql -U blinkone_app -c "\dt usage_events"`

---

## TRD REQUIREMENTS COVERED

| TRD ID | Requirement | Status After Prompt |
|--------|-------------|---------------------|
| TR-44  | Usage metering for voice minutes | ✅ DONE |
| TR-45  | Message-based usage billing | ✅ DONE |
| TR-46  | AI token usage tracking | ✅ DONE |
| TR-47  | Usage dashboard for tenant admin | ✅ DONE |
