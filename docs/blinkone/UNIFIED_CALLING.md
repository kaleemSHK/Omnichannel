# Unified Mobile & Browser Calling

Production architecture for BlinkOne omni-channel voice: one mobile app (User + Agent roles), browser agent desk, shared ACD, WebRTC/SIP media.

## Call scenarios (implementation map)

| Scenario | Media path | Signaling / ACD |
|----------|------------|-----------------|
| User mobile → Agent browser | JsSIP `customer` → queue/ext → Kamailio `blinkone` | `POST /api/customer/call/request` + SIP |
| User mobile → Agent mobile | Peer SIP / queue bridge | Same + FCM `call.ringing` |
| Agent browser → User mobile | JsSIP outbound + push | `createCall` + route assign |
| Agent mobile ↔ Agent browser | Dial `blinkone` or agent id | Kamailio registrar |
| All agents busy | Redis FIFO queue | `route/request` → `queued` → poll / Cable |

## Roles (single mobile binary)

| Role | Auth | UI |
|------|------|-----|
| **Agent** | Chatwoot + gateway JWT | Dashboard, dial, contacts, SIP overlay |
| **User / Complainant** | `POST /api/customer/session` | Home, queue, chat, tickets |

## Services

| Layer | Path |
|-------|------|
| Signaling (SIP) | `infra/kamailio/kamailio-twilio-wss.cfg`, `wss://sip.blinksone.com` |
| ACD / queues | `services/routing` — `route/request`, `assign`, `complete` |
| CDR / sessions | `services/calls` |
| Realtime UI | Action Cable `BlinkoneCallChannel`, routing WS `/v1/realtime` |
| Push (mobile) | `gateway/lib/push.js`, FCM |
| Browser UI | `frontend/src/components/calling/*` |
| Mobile UI | `mobile/src/components/calling/*`, `mobile/src/hooks/useJsSip.ts` |

## Signaling events (normalized)

| Event | Source | Consumers |
|-------|--------|-----------|
| `call:initiate` | Client / gateway | Queue screen |
| `call:ringing` | `broadcastCallRinging` | PhonePanel, AgentCallOverlay, FCM |
| `call:queued` | `route/request` | Customer queue UI |
| `queue:update` | Poll `GET …/route/calls/:id/status` | Customer queue UI |
| `call:accepted` | SIP `confirmed` + `route/assign` | Active call |
| `call:connected` | Cable `call.connected` | Workspace |
| `call:ended` | SIP `ended` + `route/complete` | History, ACW |
| `agent:available` | `PATCH /v1/agents/:id` | Wallboard, routing |

## Agent statuses

`available` | `busy` | `break` | `offline` | `acw` — stored in Redis via routing service; JsSIP must not override manual break/offline.

## Phase roadmap

1. **Phase 1 (current)** — Queue status API, customer call request, mobile queue UI, agent `route/complete` wiring, docs.
2. **Phase 2** — Per-agent SIP creds aligned with Asterisk bridge; full `route/assign` on web answer.
3. **Phase 3** — WhatsApp SDP on Next.js; supervisor AMI.
4. **Phase 4** — Horizontal WS fan-out (Redis pub/sub), rate limits, RBAC on calls API.

## Quick test

1. Agent: web `/calling` — SIP registered (`blinkone`).
2. Agent: mobile — login, status **Available**.
3. User: mobile customer — **Call Support** → queue or connect.
4. Mobile agent dials `blinkone` to ring web desk.
