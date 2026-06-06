# Live data policy (no mock fallbacks in production)

## Rule

Calling, routing, queues, agent presence, and wallboard **must use live backend data** unless explicitly opted into demo mode.

| Source | Technology |
|--------|------------|
| Agent availability | `PATCH /api/routing/v1/agents/:id` → Redis (`routing` service) |
| Queue position | `GET /api/customer/call/:callId/status` → Redis ZSET + Postgres meta |
| Active / ringing calls | `GET /api/calls/v1/...` + Action Cable `call.ringing` |
| Wallboard | `GET /api/routing/v1/dashboards/realtime` + `wss://…/ws/routing/v1/realtime` |
| IVR | Postgres `ivr_flows` / `ivr_flow_versions` (seed: `scripts/seed-main-support-ivr.mjs`) |

## Opt-in demo only

Set **`NEXT_PUBLIC_USE_DEMO_DATA=true`** in `.env.local` for offline UI work.  
**Never** set this in production (`.env.production`).

## Code conventions

- `isLiveGatewayEnabled()` — use for telephony React Query hooks (`frontend/src/lib/live-data/policy.ts`).
- On API failure in live mode: return **`[]`** or show error — **do not** substitute `DEMO_*` fixtures.
- `normalizeRoutingAgent()` — map API `status` → UI `state` (`frontend/src/lib/api/routing-agents.ts`).
- SIP `registered` → sync routing `available` + `support` skill (`useJsSip`).

## Mobile

- Customer queue: gateway → routing (no local mock queue).
- Agent state: `useRoutingPresence` + `setAgentState` API.
- `AGENT_DESK_EXT=blinkone` — real SIP user for web desk after ACD assign.

## Verify production

```bash
# Queue status (must be 200, not 404)
curl -s -H "Authorization: Bearer $ROUTING_TOKEN" -H "X-Blinkone-Tenant-Id: 1" \
  http://127.0.0.1:8798/v1/route/calls/test-id/status

# Realtime dashboard
curl -s -H "Authorization: Bearer $ROUTING_TOKEN" -H "X-Blinkone-Tenant-Id: 1" \
  http://127.0.0.1:8798/v1/dashboards/realtime
```
