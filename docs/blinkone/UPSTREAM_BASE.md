# Upstream base — Chatwoot CE

BlinkOne tracks **Chatwoot Community Edition** via the official Docker image (no Rails/Vue fork in this repository yet).

| Field | Value |
|-------|--------|
| **Product** | Chatwoot CE |
| **Image (upstream)** | `chatwoot/chatwoot:v4.13.0-ce` |
| **Image (BlinkOne)** | `blinkone/chatwoot:v4.13.0-ce-b1` (local build) |
| **Upstream tag** | [v4.13.0](https://github.com/chatwoot/chatwoot/releases/tag/v4.13.0) |
| **Recorded** | 2026-05-20 |
| **Deploy model** | Docker Compose (`docker-compose.yml`) |
| **Fork commit SHA** | _N/A — image deploy; record SHA here when a source fork is added_ |

## Pinned images (no `:latest`)

| Service | Image |
|---------|--------|
| Chatwoot / Sidekiq | `${CHATWOOT_IMAGE}` → default **`blinkone/chatwoot:v4.13.0-ce-b1`** (local build; upstream CE has no BlinkOne UI) |
| PostgreSQL (Chatwoot) | `pgvector/pgvector:pg16` |
| PostgreSQL (sidecars) | `postgres:16-alpine` |
| Redis | `redis:7-alpine` |
| Nginx | `nginx:1.27-alpine` |

Set in `.env`:

```bash
# Local BlinkOne (includes overlay + Vite rebuild):
CHATWOOT_IMAGE=blinkone/chatwoot:v4.13.0-ce-b1

# Upstream CE only (no BlinkOne dashboard changes — do not use for demos):
# CHATWOOT_IMAGE=chatwoot/chatwoot:v4.13.0-ce
```

## Upgrade procedure

1. Read [Chatwoot release notes](https://github.com/chatwoot/chatwoot/releases) for the target version.
2. Update `CHATWOOT_IMAGE` in `.env` / `.env.staging.example`.
3. Update this file (tag, date, link).
4. Pull and restart on **staging** first:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.staging.yml \
     --env-file .env.staging -p blinkone-staging pull chatwoot sidekiq
   docker compose -f docker-compose.yml -f docker-compose.staging.yml \
     --env-file .env.staging -p blinkone-staging up -d
   ```

5. Run Chatwoot migrations (entrypoint runs on boot); verify `/auth/sign_in`.
6. Promote to production after sign-off.

## Quarterly upstream merge (when using a source fork)

1. `git fetch upstream-chatwoot`
2. Merge into `blinkone/develop` in the fork repository.
3. Resolve `# BLINKONE:` conflicts.
4. Rebuild or retag Docker image if you publish a custom fork image.
5. Update this document and open PR to `blinkone/main`.

## Changelog pointer

Upstream changes at fork time: https://github.com/chatwoot/chatwoot/compare/v4.12.0...v4.13.0
