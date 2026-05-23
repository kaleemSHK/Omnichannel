# BlinkOne telephony calling (agent view)

Dual-transport calling: **PSTN** (Asterisk + JsSIP) and **WhatsApp Business Calling API**.

## Prerequisites

- `docker compose -f docker-compose.yml -f docker-compose.blinkone.yml -f docker-compose.telephony.yml --profile telephony up -d`
- nginx `/telephony/wss` → `blinkone-asterisk:8089/ws`
- Postgres `blinkone_app` with calls + tickets migrations
- Tenant features: `calling.pstn`, `calling.whatsapp`

## Meta WhatsApp Calling

1. Meta Business Portfolio approved for Calling
2. WABA messaging limit Level 2+
3. Set `WHATSAPP_CALLING_ENABLED=1` and register webhook `GET/POST /api/whatsapp-calls/v1/webhooks/meta`

## Agent UI (Chatwoot)

| Surface | Component |
|---------|-----------|
| Incoming Calls sidebar | `IncomingCallsPanel.vue` |
| Chats \| Calls tabs | `CallsHistoryTab.vue` |
| In-conversation banner | `ConversationCallBanner.vue` |
| Call activities tab | `CallActivitiesPanel.vue` |
| Outbound picker | `ChannelCallPicker.vue` |

Patches: `scripts/blinkone/patch-chatwoot-calling-inbox.mjs` (Docker build).

## APIs

- `GET /api/calls/v1/calls` — list (`status`, `scope=all|mine|unassigned`)
- `GET /api/calls/v1/calls/incoming` — ringing queue
- `POST /api/calls/v1/calls/:id/answer|decline|hangup|transfer`
- `GET /api/routing/v1/agents/:id/webrtc` — JsSIP credentials
- `WS /api/routing/v1/realtime` — queue stats

## Acceptance

```bash
# PSTN stack up
curl -s http://localhost/api/routing/v1/agents/1/webrtc?tenant_id=1 -H "Authorization: Bearer $ROUTING_TOKEN"

# Calls list
curl -s "http://localhost/api/calls/v1/calls/incoming?tenant_id=1" -H "Authorization: Bearer $CALLS_TOKEN"
```
