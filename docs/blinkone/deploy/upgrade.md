# Upgrading Chatwoot CE (upstream merge)

BlinkOne tracks pinned CE tags — see [UPSTREAM_BASE.md](../UPSTREAM_BASE.md).

## Process

1. Fetch upstream tag `v4.x.x-ce` into `upstream/chatwoot` remote.
2. Merge into `blinkone/main` branch for Chatwoot base only.
3. Re-apply overlay: `chatwoot-fork-overlay/`, `docker/chatwoot-blinkone/Dockerfile` patches.
4. Run `scripts/blinkone/patch-chatwoot-telephony.mjs` in Docker build.
5. Rebuild image: `docker compose build chatwoot`.
6. Run Chatwoot migrations: `docker compose run chatwoot bundle exec rails db:migrate`.
7. Smoke test inbox + telephony admin routes.
8. Tag release `blinkone-vX.Y.Z`.

**Never** copy files from `enterprise/` — pre-commit hook enforces blocklist.
