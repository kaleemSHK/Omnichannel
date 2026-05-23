# Telephony Step 1 — Asterisk + Kamailio + RTPEngine

Prompt 5 stops here for review before IVR/ACD (steps 2–10).

## Architecture

```
Softphone (UDP) ──► :5060 Kamailio (SBC) ──► Asterisk :5060
                      │                        │
                      └── RTPEngine (media) ◄──┘

Direct dev test (bypass Kamailio): Softphone ──► Asterisk :5062
```

| Service | Host port | Purpose |
|---------|-----------|---------|
| `blinkone-kamailio` | 5060 udp/tcp | Public SIP entry (SBC) |
| `blinkone-asterisk` | 5062 udp/tcp | Direct SIP (dev softphone) |
| `blinkone-asterisk` | 8088 | ARI HTTP (IVR step 2) |
| `blinkone-asterisk` | 8089 | WebRTC WSS (agent step 9) |
| `blinkone-rtpengine` | 22222 udp, 30000–30100 udp | Media relay / NAT (Debian `rtpengine-daemon`) |

## Start

```powershell
cd E:\BlinkOne
docker compose -f docker-compose.yml -f docker-compose.blinkone.yml -f docker-compose.telephony.yml --profile telephony up -d --build
```

Set in `.env` (LAN IP if testing from another machine):

```env
TELEPHONY_EXTERNAL_IP=192.168.1.50
TELEPHONY_LOCAL_NET=192.168.0.0/16
AST_AGENT_SIP_PASS=blinkone-agent-dev
```

## Hand-test A — Park extension (no ARI)

1. Install [Zoiper](https://www.zoiper.com/) or Linphone.
2. SIP account:
   - **Server:** `127.0.0.1:5062` (direct to Asterisk)
   - **User:** `1000`
   - **Password:** value of `AST_AGENT_SIP_PASS` (default `blinkone-agent-dev`)
3. Dial **1000** → call should answer and park (music on hold / silence).
4. From a second softphone registered as `1000`, dial **700** to pick up parked call (Asterisk default park retrieve) or use `parkedcalls` CLI.

Dial **1001** for echo test.

## Hand-test B — Through Kamailio

1. Register softphone to `127.0.0.1:5060` (same credentials; Kamailio forwards to Asterisk).
2. Dial **1000** (routed to Asterisk `from-internal` via Kamailio — may need dialplan/context tuning in step 2).

## Hand-test C — Inbound trunk context (Stasis)

Calls hitting `from-trunk` enter `Stasis(blinkone-ivr,...)`. With step 2 enabled, you hear welcome + hangup — see `docs/blinkone/TELEPHONY_STEP2.md`.

## Useful CLI

```bash
docker exec -it blinkone-blinkone-asterisk-1 asterisk -rvvv
# pjsip show endpoints
# pjsip show registrations
# core show channels
# parkedcalls show
```

## ARI (prep for step 2)

```bash
curl -u blinkone:blinkone-ari-secret http://localhost:8088/ari/asterisk/info
```

## What comes next (do not skip review)

| Step | Deliverable |
|------|-------------|
| 2 | IVR NestJS ARI app — play welcome, hang up |
| 3 | Flow Postgres + admin UI |
| 4–5 | Routing / ACD |
| 6 | CDR + recordings → MinIO |
| 7 | Supervisor listen/whisper/barge |
| 8 | Real-time dashboards |
| 9 | Chatwoot PhonePanel (JsSIP) |
| 10 | SIPp CI |

## Files

- `infra/asterisk/` — image, PJSIP, dialplan, DTLS script, `tenants.yaml.example`
- `infra/kamailio/` — SBC config, DID map example
- `docker-compose.telephony.yml` — `--profile telephony`
