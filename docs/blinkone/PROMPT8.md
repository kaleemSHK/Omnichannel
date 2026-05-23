# Prompt 8 — Multi-tenant + white-label (complete)

One Chatwoot Account = one BlinkOne tenant = one LABBIK client. Control plane: `services/tenant/` on port **8802**.

## Steps 1–3 (foundation)

See `PROMPT8_RLS_REVIEW.md` for RLS sign-off. Migrations in each sidecar `db/003_rls.sql`.

## Step 4 — Redis namespacing

- Helper: `services/_shared/lib/redis-keys.js` → `t:{tenantId}:...`
- Routing retrofitted: `routing/lib/redis-state.js`, `call-meta.js`
- Event bus idempotency keys: `t:{tenant_id}:idempotency:...`

## Step 5 — Gateway host resolver

- `services/gateway/src/host/host-resolver.service.ts`
- Fastify hook in `main.ts` sets `x-blinkone-tenant-id` + branding from `GET /v1/resolve-host`
- Login injects host-resolved `tenant_id` + `branding` into JWT
- Cross-tenant JWT vs Host header → **403** (unless `platform_admin`)

## Step 6 — Rails middleware

- `chatwoot-fork-overlay/app/middleware/blinkone_host_resolver.rb`
- `lib/blink_one/branding.rb` — `BlinkOne::Branding.for_tenant(id).frontend_url`
- `config/initializers/blinkone_host_middleware.rb`

## Step 7 — ACME / custom domains

- `services/tenant/lib/acme.js` — worker every 120s; `ACME_STUB=1` auto-issues SSL in dev
- `POST /v1/domains/:domainId/verify-acme` — manual trigger
- Domains: `POST /v1/tenants/{id}/domains` with DNS CNAME instructions

## Step 8 — Platform admin UI

- Settings → `blinkone/platform/tenants` (list + wizard + detail)
- Legacy URL: `/blinkone/platform/tenants`
- API via `useBlinkoneApi().platform` + `platformToken`

## Step 9 — Tenant branding UI

- Settings → `blinkone/branding` (colors, CSS, domains, preview)
- Legacy URL: `/blinkone/admin/branding`
- `PATCH /v1/tenants/{id}/branding`

## Step 10 — Cross-tenant gauntlet + suspension

- Test: `tests/blinkone/cross-tenant-gauntlet.test.js`
- Run: `RUN_GAUNTLET=1 BLINKONE_DATABASE_URL=... node --test tests/blinkone/cross-tenant-gauntlet.test.js`
- Suspension: `tenantSuspendedMiddleware` on routing, sla, ai → **423**
- UI banner: `SuspensionBanner.vue` (mount in dashboard shell when patching Chatwoot layout)

## MinIO

Object keys prefixed `tenants/{tenantId}/...` in `services/ai/lib/minio.js`.

## RBAC

Platform roles in `@blinkone/rbac`: `platform_admin`, `platform_support`, `platform_billing` bypass permission checks.

## Smoke

```powershell
# Provision (platform admin)
$h = @{ Authorization = "Bearer $env:PLATFORM_TOKEN"; "X-Blinkone-Platform-Role" = "platform_admin" }
Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:8080/blinkone/api/v1/tenant/v1/tenants" -Headers $h -ContentType "application/json" -Body '{"name":"Oman Tel","slug":"omantel","ownerEmail":"owner@omantel.om"}'

# Resolve host
Invoke-RestMethod "http://127.0.0.1:8802/v1/resolve-host?host=omantel.blinkone.local" -Headers @{ Authorization = "Bearer $env:PLATFORM_TOKEN" }

# Gauntlet
$env:RUN_GAUNTLET = "1"
node --test tests/blinkone/cross-tenant-gauntlet.test.js
```

Rebuild: `docker compose build tenant gateway routing sla ai chatwoot`
