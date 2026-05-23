# Telephony Step 3 — Versioned IVR flows (Postgres + admin UI)

## What shipped

| Area | Details |
|------|---------|
| **Postgres** | `ivr_flows`, `ivr_flow_versions` (+ `ivr_schema_migrations`) |
| **API** | CRUD on `/v1/flows`; immutable graphs via `POST /v1/flows/{id}/versions` |
| **ARI** | Executes active graph (`play`, `hangup`, stub `enqueue`) per tenant |
| **Admin** | Chatwoot **Settings → IVR flows** (see [CHATWOOT_TELEPHONY_ADMIN.md](./CHATWOOT_TELEPHONY_ADMIN.md)) |

## Graph schema (minimal DAG)

```json
{
  "entry": "welcome",
  "nodes": [
    { "id": "welcome", "type": "play", "media": "sound:hello-world", "next": "hangup" },
    { "id": "hangup", "type": "hangup" }
  ]
}
```

| Node type | Fields |
|-----------|--------|
| `play` | `media`, optional `next`, optional `collectDigits` + `timeoutSec` + digit routes |
| `enqueue` | `queue` (routing handoff in step 4) |
| `hangup` | — |

Digit routing: nodes with `digit: "1"` are selected after DTMF collection.

## API

| Method | Path | Auth |
|--------|------|------|
| GET | `/v1/flows?tenant_id=` | — |
| GET | `/v1/flows/{id}` | — |
| POST | `/v1/flows` | Bearer `IVR_TOKEN` |
| PATCH | `/v1/flows/{id}` | Bearer (name, `isDefault`, `activeVersionId` only) |
| GET | `/v1/flows/{id}/versions` | — |
| GET | `/v1/flows/{id}/versions/{n}` | — |
| POST | `/v1/flows/{id}/versions` | Bearer (body: `graph`, `comment?`, `setActive?`) |

Gateway prefix: `http://localhost/api/ivr/v1/...`

Tenant: `?tenant_id=` or header `X-Blinkone-Tenant-Id` (default `default`).

## Run

```powershell
docker compose -f docker-compose.yml -f docker-compose.blinkone.yml -f docker-compose.telephony.yml --profile telephony up -d --build ivr postgres_app
```

Requires `postgres_app` healthy and `APP_DB_PASSWORD` in `.env`.

## Test

1. Open admin UI, set token to `IVR_TOKEN` from `.env` (default `ivr-api-token`).
2. Tenant `default` — edit graph → **Publish new version**.
3. Softphone → dial **2000** (or trunk) — hear updated prompt from active graph.

```powershell
curl -s "http://localhost/api/ivr/v1/flows?tenant_id=default" | jq
```

## Next (step 4)

See [TELEPHONY_STEP4.md](./TELEPHONY_STEP4.md).
