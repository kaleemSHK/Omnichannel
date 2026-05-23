# High availability deployment

## Topology

- **2+ app hosts** — gateway, Chatwoot, sidecars (stateless replicas)
- **Postgres** — primary + standby (Patroni or managed RDS)
- **Redis** — Sentinel or managed Elasticache
- **MinIO** — distributed mode or S3-compatible object store
- **Load balancer** — HAProxy/nginx in front of gateway + Chatwoot

## Stateless sidecars

Scale horizontally:

```yaml
routing:
  deploy:
    replicas: 3
```

Ensure `REDIS_URL` and `BLINKONE_DATABASE_URL` point to clustered backends.

## Chatwoot

Run multiple Puma workers + separate Sidekiq hosts. Shared Postgres + Redis required.

## Backups

See [dr.md](./dr.md) — continuous WAL archiving + nightly logical dump.
