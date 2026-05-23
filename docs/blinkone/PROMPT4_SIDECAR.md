# Prompt 4 — Sidecar architecture (chassis)

TypeScript pnpm workspace for BlinkOne sidecars. Existing **JavaScript** sidecars (`services/platform`, `gateway/` Express on `:8787`) remain operational; this adds the **NestJS gateway** and shared packages for future prompts.

## File tree

```
package.json
pnpm-workspace.yaml
docker-compose.blinkone.yml
infra/prometheus/prometheus.yml
infra/grafana/provisioning/
services/
  _shared/
    tsconfig.base.json
    eslint.config.mjs
    docker/Dockerfile.base
    scripts/new-sidecar.sh
    packages/
      logger/
      tenant-context/
      event-bus/
      chatwoot-client/
      telemetry/
      openapi-loader/
      audit/
      rbac/
  gateway/                    # NestJS @ :8080
    src/
    openapi.yaml
    Dockerfile
gateway/                      # Legacy Express (nginx :80 → :8787)
services/{platform,tickets,...}  # Legacy JS sidecars (unchanged)
```

## Run

```bash
# Core stack (Chatwoot + JS sidecars + nginx)
docker compose up -d

# + NestJS gateway + optional observability (profile)
docker compose -f docker-compose.yml -f docker-compose.blinkone.yml up -d blinkone-gateway

# Full extras (MinIO, Jaeger, Prometheus, Grafana, Keycloak)
docker compose -f docker-compose.yml -f docker-compose.blinkone.yml --profile blinkone-extra up -d
```

## Verify

```bash
curl http://localhost:8080/blinkone/api/v1/healthz
curl -X POST http://localhost:8080/blinkone/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"..."}'
```

## New sidecar

```bash
bash services/_shared/scripts/new-sidecar.sh tenant 8811
```

## pnpm (local)

```bash
pnpm install
pnpm run build
pnpm --filter @blinkone/gateway start
```

## Naming map

| Prompt 4 name        | Main compose service |
|---------------------|----------------------|
| blinkone-postgres   | `postgres_app`       |
| blinkone-redis      | `redis` (alias)      |
| blinkone-gateway    | `blinkone-gateway`   |
| Legacy API gateway  | `gateway` (:8787)    |
