# Disaster recovery runbook

## RPO / RTO targets

| Tier | RPO | RTO |
|------|-----|-----|
| Postgres | 15 min (WAL) | 2 h |
| MinIO recordings | 24 h | 4 h |
| Config / compose | Git tag | 1 h |

## Backup

```bash
./scripts/blinkone/backup-production.sh
```

Includes Postgres dump, MinIO mirror (if configured), `.env` template (no secrets in git).

## Restore drill (quarterly)

1. Provision clean VM with Docker.
2. Restore Postgres: `pg_restore` or `psql < dump.sql`.
3. Restore MinIO bucket from mirror.
4. `docker compose up -d` with restored `.env`.
5. Verify: gateway health + acceptance smoke tests.

## Region failure

Maintain warm standby in second GCC region with replicated Postgres (async) and DNS failover.
