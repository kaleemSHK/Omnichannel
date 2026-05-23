# BlinkOne demo data

## Chatwoot (conversations, contacts, agent)

Idempotent rake task — safe to run multiple times (skips if ≥8 conversations exist).

```powershell
cd E:\BlinkOne
docker compose exec chatwoot bundle exec rake blinkone:demo:seed
```

**After rebuilding** the Chatwoot image (includes `blinkone_demo.rake` in the Dockerfile), you only need the exec line above.

**Before rebuild**, copy files into the running container once:

```powershell
docker compose cp lib/blink_one/demo_seeder.rb chatwoot:/app/lib/blink_one/demo_seeder.rb
docker compose cp lib/tasks/blinkone_demo.rake chatwoot:/app/lib/tasks/blinkone_demo.rake
docker compose exec chatwoot bundle exec rake blinkone:demo:seed
```

### Demo login

| Field | Value |
|-------|--------|
| Email | `demo.agent@blinkone.ai` |
| Password | `DemoAgent1!` |
| Account | First account (usually id **1**) |

### What gets created

- **Website Support** web widget inbox
- **8 conversations** (Oman-themed telecom scenarios): open, pending, resolved, urgent/high/medium/low priority
- Labels: `sales`, `support`, `billing`, `vip`, `sla-risk`
- Agent **Sarah Al-Hinai** added as administrator on the account

## Full stack (Chatwoot + sidecars)

```powershell
.\scripts\seed-demo.ps1 -TenantId 1
```

Requires: `sla` and `routing`/`ivr` containers up with Postgres migrations applied:

```powershell
docker compose up -d sla escalation routing ivr postgres_app
docker compose build sla
docker compose up -d sla
```

Then sidecar seed:

```powershell
$env:BLINKONE_DATABASE_URL="postgresql://app:YOUR_APP_DB_PASSWORD@127.0.0.1:5433/blinkone_app"  # if postgres exposed
# Or via docker network:
docker run --rm --network blinkone_blinkone -v "${PWD}/scripts:/scripts" -w /scripts `
  -e BLINKONE_DATABASE_URL=postgresql://app:apppass@postgres_app:5432/blinkone_app `
  -e SEED_TENANT=1 node:20-alpine sh -c "npm i pg@8 && node seed-sla.mjs"
```

## Re-run / reset

To replace conversations, delete demo conversations in Chatwoot UI or run:

```powershell
docker compose exec chatwoot bundle exec rails runner "Account.find(1).conversations.where('id > 0').destroy_all"
docker compose exec chatwoot bundle exec rake blinkone:demo:seed
```
