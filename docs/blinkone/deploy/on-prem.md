# On-premises deployment (single-server Compose)

## Prerequisites

- Docker 24+ and Compose v2
- 8 GB RAM minimum (16 GB for Chatwoot asset build)
- Ports 80/443 (nginx), optional 8787 (gateway debug)

## Steps

1. Copy `.env.example` → `.env` and set secrets (`SECRET_KEY_BASE`, `JWT_SECRET`, `APP_DB_PASSWORD`, tokens).
2. Build Chatwoot image: `docker compose build chatwoot` (first run ~15 min).
3. Start stack: `docker compose up -d`.
4. Run migrations: sidecars auto-migrate on boot when `BLINKONE_DATABASE_URL` is set.
5. Open `FRONTEND_URL` → complete Chatwoot super admin setup.
6. Seed demo: `pnpm seed:demo` (optional).

## Verify

```powershell
curl http://127.0.0.1:8787/health
RUN_ACCEPTANCE=1 node tests/acceptance/runner.mjs
```

## TLS

Terminate TLS at nginx in `infra/nginx` — point `FRONTEND_URL` to `https://your-host`.
