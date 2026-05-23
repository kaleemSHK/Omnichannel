# Prompt 6 — SLA + Escalation

## Started

| Step | Item | Status |
|------|------|--------|
| 1 | ADR `docs/blinkone/adrs/006-sla-escalation.md` + SQL | Done |
| 3 | `WorkingTime` + tests | Done |
| 4 | SLA Postgres CRUD, instances, events | Done |
| 5 | SLA worker (30s breach/warning) | Done |
| 6 | Chatwoot Settings UI (policies, calendars, dashboard) | Done |
| 7 | Escalation rulesets + JSON-Logic simulate | Done |
| 8 | Action stubs (change_priority, add_label, …) | Stub |
| 9 | Escalation UI | Done |
| 10 | Full integration tests / fast-check SLA | Partial |

## Deploy

```powershell
docker compose build sla escalation gateway chatwoot
docker compose up -d sla escalation gateway chatwoot postgres_app
docker compose exec -e BLINKONE_DATABASE_URL=postgresql://app:$env:APP_DB_PASSWORD@postgres_app:5432/blinkone_app sla node /app/scripts/seed-sla.mjs
# Or from host after migrations:
$env:BLINKONE_DATABASE_URL="postgresql://app:YOUR_PASSWORD@localhost:5433/blinkone_app"
node scripts/seed-sla.mjs
```

## API smoke (direct)

```powershell
$h = @{ Authorization = "Bearer $env:SLA_TOKEN"; 'X-Blinkone-Tenant-Id' = 'default' }
Invoke-RestMethod -Uri http://127.0.0.1:8796/v1/policies -Headers $h
```

Gateway now accepts **service tokens** (same as sidecar `TOKEN`) for `/api/sla`, `/api/routing`, `/api/escalation`, `/api/ivr`.

## Chatwoot

**Settings** sidebar: SLA policies, SLA dashboard, Escalation rules.

Legacy URLs redirect: `/blinkone/admin/sla/policies`, `/blinkone/admin/escalations`.

## Demo data (Chatwoot + sidecars)

```powershell
# After chatwoot image includes blinkone_demo.rake (rebuild once):
.\scripts\seed-demo.ps1 -TenantId 1
```

Creates **demo.agent@blinkone.ai** / **DemoAgent1!**, 8 sample conversations (Oman-themed), labels, SLA policies, escalation rules, queues, and IVR flow.

## Not yet

- Conversation header SLA badge + Action Cable
- Redis Redlock on instance writes
- Chatwoot webhook fan-in (Prompt 10 integration)
- Full escalation actions via Chatwoot API
