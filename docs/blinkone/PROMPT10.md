# Prompt 10 — Integration sidecar (TR-46 to TR-50, TR-57)

## Status

Implemented in `services/integration/` with Postgres, Redis event stream, outbound webhook worker, inbound Chatwoot/PSP receivers, SSO/Keycloak provisioner (stub), connector framework, audit API, API docs portal, and Chatwoot admin UI.

## Defaults (confirm with LABBIK)

| Topic | Implementation default |
|-------|------------------------|
| Priority ERP connector | **Generic REST** (concrete) + **SAP B1** skeleton |
| Audit retention | **7 years** (documented; no auto-purge job yet) |
| Omani government | **Tasdeeq** placeholder connector (`tasdeeq`) |
| Keycloak | `KEYCLOAK_STUB=1` for local dev; set `KEYCLOAK_URL` for real Admin API |

## Architecture

```
Chatwoot webhook → gateway → integration /webhooks/chatwoot
                              → Redis stream blinkone:events
                              → outbound webhook deliveries (HMAC signed)
                              → ERP connectors (generic_rest, …)
```

### Outbound signature

`X-BlinkOne-Signature: t=<unix>,v1=<hmac_sha256(secret, t + '.' + rawBody)>`

See `GET /v1/webhooks/signature-docs`.

### Retry policy

1m → 5m → 30m → 2h → 12h → 24h → **dead**

## Key endpoints

| Path | Purpose |
|------|---------|
| `POST /webhooks/chatwoot` | Inbound Chatwoot (HMAC) |
| `POST /webhooks/psp/:provider` | Inbound PSP |
| `POST /v1/webhooks/dispatch` | Gateway fan-out |
| `GET/POST /v1/webhooks` | Endpoint CRUD |
| `PUT /v1/sso/config` | Tenant SSO + Keycloak realm |
| `GET /v1/sso/login?tenant=` | Login URL |
| `PUT /v1/connectors/:type` | Connector config |
| `GET /v1/audit` | Search audit log |
| `GET /blinkone/api/docs` | Swagger UI |

## UI (Chatwoot settings)

| Route | Purpose |
|-------|---------|
| `.../blinkone/admin/webhooks` | Outbound webhooks + deliveries |
| `.../blinkone/admin/sso` | SSO config |
| `.../blinkone/admin/integrations` | ERP connectors |
| `.../blinkone/admin/audit` | Audit timeline + CSV |

## Tests

```powershell
node --test tests/blinkone/integration.test.js
$env:BLINKONE_DATABASE_URL="postgresql://app:PASS@localhost:5433/blinkone_app"
$env:RUN_INTEGRATION_TESTS="1"
node --test tests/blinkone/integration.test.js
```

## Compose

`integration` service: `BLINKONE_DATABASE_URL`, `REDIS_URL`, `CHATWOOT_WEBHOOK_SECRET`, `KEYCLOAK_*`, `INTEGRATION_WORKERS=1`.

## Follow-up

- Wire JIT provision to Chatwoot Platform API
- Full Keycloak realm + IdP templates per provider
- Aggregated OpenAPI merge from all sidecar YAML files
- CI audit-completeness enumeration across sidecars
- SSO E2E with mock OIDC IdP
