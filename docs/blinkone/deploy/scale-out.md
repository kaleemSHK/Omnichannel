# Scale-out guide

## Routing service

- Increase replicas; enable `ROUTING_QUEUE_WORKER=1` on one pod only (leader election TODO).
- Partition high-volume tenants to dedicated queue keys if needed.

## AI service

- Scale replicas; sticky sessions not required for REST.
- Piper TTS: dedicated GPU host for `blinkone-piper`.

## Gateway

- Scale replicas behind LB; shared `JWT_SECRET`.
- Consider rate limiting per tenant at edge.

## Postgres

- Read replicas for reporting; writes to primary only.
- Connection pooler (PgBouncer) in front of sidecars.
