# Telephony steps 5–9 (Prompt 5)

## Step 5 — ACD selection + assign

- `lib/selection.js` — skill-match → longest-idle → least-occupied
- `POST /v1/route/request` — assigns immediately if agent free, else enqueues
- `POST /v1/route/assign` — manual / `processQueue: true`
- `POST /v1/route/complete` — frees agent + writes CDR
- `POST /v1/route/process-queue` — dequeue + assign next caller
- Background queue worker (`ROUTING_QUEUE_WORKER=1`, tick 5s)
- IVR `POST /v1/bridge` — bridge to agent SIP (`ASTERISK_ARI_BRIDGE=1` for live ARI)

## Step 6 — CDR + recordings

- `POST /api/calls/v1/cdr` — call session + optional recording notify
- `GET /api/recordings/v1/recordings/:id/url` — signed playback (5 min default)
- Asterisk MixMonitor files → ingest via recording service (extend with MinIO in prod)

## Step 7 — Supervisor

- `GET /v1/supervise/sessions` — active calls
- `POST /v1/supervise/:callId/mode` — `listen | whisper | barge`
- IVR `POST /v1/supervise` — ChanSpy hook (dialplan in production)

## Step 8 — Dashboards

- `GET /v1/dashboards/realtime`
- `GET /v1/reports/agents?from=&to=`
- Chatwoot: **Settings → Telephony realtime / Agent reports**

## Step 9 — Agent phone panel

- Chatwoot: **Settings → Phone panel** (agent status + queue snapshot)
- JsSIP WebRTC placeholder — wire to `wss://host:8089` when ready

## Rebuild

```powershell
docker compose build routing ivr calls recording chatwoot
docker compose up -d routing ivr calls recording chatwoot nginx
docker compose restart nginx
```

## Quick test (step 5) — PowerShell

`curl -H` does not work in PowerShell. Use the script or `Invoke-RestMethod`:

```powershell
cd E:\BlinkOne
# Reads ROUTING_TOKEN from .env (e.g. dev-routing-token); hits routing directly on :8798
.\scripts\test-routing.ps1 -TenantId 1
```

Do **not** use `http://localhost/api/routing` with the service token — the gateway treats `Authorization: Bearer` as a **JWT**, not `ROUTING_TOKEN`.

Manual equivalent:

```powershell
$h = @{
  Authorization = 'Bearer routing-api-token'
  'Content-Type' = 'application/json'
  'X-Blinkone-Tenant-Id' = '1'
}
Invoke-RestMethod -Method POST -Uri 'http://localhost/api/routing/v1/agents' -Headers $h -Body (@{
  agentId='1000'; status='available'; skills=@('sales'); queueKeys=@('sales')
} | ConvertTo-Json)

Invoke-RestMethod -Method POST -Uri 'http://localhost/api/routing/v1/route/request' -Headers $h -Body (@{
  queue='sales'; callId='test-ch-1'; callerId='+15551212'
} | ConvertTo-Json)
```

## Overflow (TR-15)

Set `max_depth` / `max_wait_sec` + `overflow_queue_id` on a queue. When full or wait exceeded, callers move to the overflow queue (decision `overflow`).

## Postgres CDR

`calls` service uses `call_sessions` + `recording_objects` when `BLINKONE_DATABASE_URL` is set (compose default).
