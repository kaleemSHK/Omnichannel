# Telephony Step 4 — Routing agent state + queue model

## What shipped

| Area | Details |
|------|---------|
| **Postgres** | `routing_queues`, `routing_queue_skills`, `routing_agents`, `routing_agent_skills`, `routing_agent_queues`, `routing_decisions` |
| **Redis** | `agent:{tenant}:{agentId}` JSON state; `queue:{tenant}:{queueKey}` ZSET for waiting calls |
| **API** | Queue CRUD, agent registry, `POST /v1/route/request` (enqueue) |
| **IVR** | `enqueue` nodes call routing and hold the caller (no hangup) |
| **Admin** | Chatwoot **Settings → Call routing (ACD)** (see [CHATWOOT_TELEPHONY_ADMIN.md](./CHATWOOT_TELEPHONY_ADMIN.md)) |

Seeded queues for tenant `default`: `sales`, `support`, `default`.

## Redis agent state

```json
{
  "status": "available|busy|away|offline",
  "currentCallId": null,
  "lastIdleAt": "ISO-8601",
  "skills": ["sales"],
  "queueKeys": ["sales", "support"],
  "occupancy": 0
}
```

## API

| Method | Path | Notes |
|--------|------|-------|
| GET/POST/PATCH | `/v1/queues` | Queue model + skills |
| GET | `/v1/queues/{id}/stats` | Waiting calls + agent counts |
| GET/POST/PATCH | `/v1/agents` | Registry (Postgres) |
| POST | `/v1/agents/{id}/state` | Live state (Redis) |
| POST | `/v1/route/request` | Enqueue call — returns `queued` + position |
| POST | `/v1/route/assign` | **501** until step 5 |
| POST | `/v1/route/complete` | **501** until step 5 |

Gateway: `http://localhost/api/routing/v1/...`  
Auth: `Authorization: Bearer $ROUTING_TOKEN`

## Run

```powershell
docker compose -f docker-compose.yml -f docker-compose.blinkone.yml -f docker-compose.telephony.yml --profile telephony up -d --build routing ivr postgres_app redis
```

## Test enqueue

1. Admin → Routing → register agent `1000` as **available**.
2. IVR flow with `enqueue` node (`queue: "sales"`).
3. Dial **2000** — call should enter queue (check routing stats / IVR call state `queued`).

```powershell
curl -s -X POST http://localhost/api/routing/v1/route/request `
  -H "Authorization: Bearer routing-api-token" `
  -H "Content-Type: application/json" `
  -d '{"tenantId":"default","queue":"sales","callId":"test-call-1"}' | jq
```

## Next (step 5)

Selection algorithm (longest-idle / skill-match), `POST /v1/route/assign`, bridge via ARI.
