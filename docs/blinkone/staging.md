# BlinkOne staging environment

Staging mirrors production (same Docker images and compose services) on **isolated ports, volumes, and databases** so you can validate changes without touching customer data.

## Quick start

```bash
cp .env.staging.example .env.staging
# Edit secrets — must differ from production

docker compose -f docker-compose.yml -f docker-compose.staging.yml \
  --env-file .env.staging -p blinkone-staging up -d
```

- **URL:** http://localhost:8080 (nginx maps host `8080` → container `80`)
- **Project name:** `blinkone-staging` (separate volumes from production `blinkone`)

## Clone production into staging

1. Take a production backup (on the host running Docker):

   ```bash
   ./scripts/blinkone/backup-production.sh
   ```

2. Clone into staging with optional PII redaction:

   ```bash
   ./scripts/blinkone/clone-prod-to-staging.sh --redact
   # Or a specific backup id:
   ./scripts/blinkone/clone-prod-to-staging.sh --redact 20260520T120000Z
   ```

`--redact` deterministically hashes emails, phone numbers, and common name fields in the SQL dump before restore.

## Smoke test checklist

- [ ] Login at http://localhost:8080
- [ ] Create a test conversation (widget or API)
- [ ] Gateway health: internal `http://gateway:8787` (via `docker compose exec`)
- [ ] Sidecar data dirs empty or seeded — no production tokens in `.env.staging`

## Tear down

```bash
docker compose -f docker-compose.yml -f docker-compose.staging.yml \
  --env-file .env.staging -p blinkone-staging down
```

To remove staging volumes (destructive):

```bash
docker compose -f docker-compose.yml -f docker-compose.staging.yml \
  --env-file .env.staging -p blinkone-staging down -v
```

## Notes

- Pin `CHATWOOT_IMAGE` to the same tag as production (`docs/blinkone/UPSTREAM_BASE.md`).
- Do not point staging webhooks at production integrations.
- Set `DISABLE_TELEMETRY=true` on Chatwoot if you enable it in production.
