# Prompt 9 — Billing sidecar (TR-42 to TR-45)

## Status

Implemented in `services/billing/` with Postgres migrations, OMR default, 5% VAT (per-subscription override), manual/PSP stub webhooks, dunning worker, platform + tenant billing UI.

## PSP / currency (confirm with LABBIK)

| Decision | Implementation default |
|----------|------------------------|
| Currency | **OMR** (`CURRENCY=OMR`) |
| VAT | **5%** (`DEFAULT_VAT_RATE=0.05`), overridable per `billing_subscriptions.vat_rate` |
| PSP | **Manual + webhook stub** (`POST /v1/webhooks/psp`, `PSP_WEBHOOK_SECRET`). Thawani/Tap headers accepted; wire real signature verification when provider is chosen. |
| LABBIK CR/VAT on PDF | `LABBIK_CR_NUMBER`, `LABBIK_VAT_NUMBER` env vars (placeholders until provided) |

## Architecture

- **DB**: `services/billing/db/001_billing.sql`, `003_rls.sql` (tenant RLS on billing tables)
- **API**: Express on port **8794**, proxied at `/api/billing` via gateway
- **Workers**: daily usage rollup + dunning (`BILLING_WORKERS=1`)
- **Usage ingest**: `POST /v1/usage/events` (idempotent on `tenant_id` + `source_event_id`)
- **AI metering**: `services/ai/lib/metering.js` forwards to billing after local `ai_usage_events` insert
- **Tenant usage API**: `GET /v1/tenants/:id/usage` on tenant-service proxies billing

## Key endpoints

See `services/billing/openapi.yaml`.

## UI routes (Chatwoot settings)

| Route | Audience |
|-------|----------|
| `/app/accounts/:id/settings/blinkone/platform/billing` | LABBIK — MRR, ARR, overdue |
| `/app/accounts/:id/settings/blinkone/platform/plans` | LABBIK — plan catalog |
| `/app/accounts/:id/settings/blinkone/admin/billing` | Tenant admin — usage gauges, invoices |

Legacy redirects: `/blinkone/platform/billing`, `/blinkone/admin/billing`.

## Tests

```powershell
$env:BLINKONE_DATABASE_URL="postgresql://app:PASSWORD@localhost:5433/blinkone_app"
$env:RUN_BILLING_TESTS="1"
node --test tests/blinkone/billing.test.js
```

Covers: VAT math, usage idempotency, overage invoice line, RLS cross-tenant, dunning → `past_due`.

## Compose

`billing` service uses `BLINKONE_DATABASE_URL`, `BILLING_TOKEN`, `LABBIK_*`, `PSP_WEBHOOK_SECRET`. Chatwoot injects `billingToken` for dashboard API calls.

## Not yet wired (follow-up)

- Routing/gateway producers emitting `usage.minute` / `usage.message` on each event
- MinIO upload for invoice PDF (HTML stub → `pdf_minio_key` only)
- Real Thawani/Tap charge + card tokenization
- Email send on `POST /v1/invoices/{id}/send`
- `subscription.payment_failed_terminal` bus event after retry schedule
