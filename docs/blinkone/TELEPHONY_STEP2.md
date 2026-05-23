# Telephony Step 2 — IVR ARI app (welcome + hangup)

Hardcoded Stasis flow in `services/ivr/src/ari-app.js`. No Postgres flows yet (step 3).

## Flow

1. Channel enters `Stasis(blinkone-ivr, …)`
2. Answer
3. Play `IVR_WELCOME_MEDIA` (default `sound:hello-world`)
4. Hangup

## Start stack

```powershell
docker compose -f docker-compose.yml -f docker-compose.blinkone.yml -f docker-compose.telephony.yml --profile telephony up -d --build ivr blinkone-asterisk
```

Rebuild `ivr` after code changes:

```powershell
docker compose build ivr
docker compose up -d ivr
```

## Test

1. Register softphone to Asterisk **:5062** (user `1000`, password from `AST_AGENT_SIP_PASS`).
2. Dial **2000** — you should hear the welcome prompt, then the call ends.
3. Check IVR logs:

```powershell
docker compose logs ivr --tail 30
```

4. Debug call state (use channel id from logs):

```powershell
docker compose exec ivr wget -qO- "http://localhost:8795/v1/calls/CHANNEL_ID/state" --header="Authorization: Bearer $env:IVR_TOKEN"
```

## Inbound trunk test

Calls on `from-trunk` also hit Stasis. Send a call through Kamailio (:5060) to any extension matching `_X.` — same welcome flow.

## Env

| Variable | Default |
|----------|---------|
| `ASTERISK_ARI_ENABLED` | `1` (telephony compose only) |
| `ASTERISK_ARI_URL` | `http://blinkone-asterisk:8088` |
| `ASTERISK_ARI_USER` / `ASTERISK_ARI_PASSWORD` | match `AST_ARI_*` on Asterisk |
| `ASTERISK_ARI_APP` | `blinkone-ivr` |
| `IVR_WELCOME_MEDIA` | `sound:hello-world` |

## API (existing + step 2)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/v1/calls/:callId/state` | Debug — channel id from ARI logs |
| GET | `/v1/flows` | Placeholder store (step 3 → Postgres) |

Gateway: `http://localhost/api/ivr/v1/...` (via legacy gateway on :80).

## Next (step 3)

See [TELEPHONY_STEP3.md](./TELEPHONY_STEP3.md).
