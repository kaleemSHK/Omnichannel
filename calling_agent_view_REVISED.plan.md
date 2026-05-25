---
name: BlinkOne Calling — Agent View (TRD-Aligned, Revised)
overview: >
  Inbox-first dual-transport calling (WhatsApp Business Calling API + WebRTC/PSTN via Asterisk).
  Matches Respond.io agent UX. Fully aligned to LABBIK TRD requirements TR-06, TR-11, TR-16, TR-17, TR-19, TR-29, TR-35.
  Cursor plan reviewed and corrected May 2026.
todos:
  - id: call-session-schema
    content: "Extend services/calls DB: add conversation_id, contact_id, transport, direction, call_events table. Migrate flat-file tickets store at same time."
    status: pending
  - id: calls-rest-api
    content: "Unified call API: GET /v1/calls, POST /v1/calls/:id/answer|hangup|transfer. Expose via gateway /api/calls/*"
    status: pending
  - id: nginx-wss-proxy
    content: "Add nginx location /telephony/wss → Asterisk :8089 (WSS). Currently MISSING from nginx.conf."
    status: pending
  - id: routing-webrtc-creds
    content: "Add GET /v1/agents/:id/webrtc to routing service — return STUN/TURN + SIP creds for JsSIP UA."
    status: pending
  - id: pstn-jssip-composable
    content: "useJsSipAgent.js — JsSIP UA, register, answer/hangup/hold/transfer. Wire to routing POST /v1/route/assign and /v1/route/complete."
    status: pending
  - id: inbox-calls-tab
    content: "Patch Chatwoot inbox list: Chats/Calls tabs. Calls tab polls GET /api/calls/v1/calls?status=active,ringing."
    status: pending
  - id: conversation-call-bar
    content: "ConversationCallBar.vue — sticky above message thread: caller name, timer, mute, hold, hangup, transfer. Mounted via overlay patch."
    status: pending
  - id: call-activities-panel
    content: "CallActivitiesPanel.vue — right panel tab showing call_events timeline (ringing→answered→ended→transfer)."
    status: pending
  - id: action-cable-channel
    content: "BlinkoneCallChannel (ActionCable) — push incoming, ended, transfer events to all agents in account."
    status: pending
  - id: wa-calling-service
    content: "services/whatsapp-calls — Meta webhooks, SDP relay, RTCPeerConnection browser leg. Phase 3 only after Meta Calling approved."
    status: pending
  - id: feature-flags
    content: "Add blinkone.calling.pstnEnabled and blinkone.calling.whatsappEnabled flags in tenant-service. Guard all calling UI."
    status: pending
  - id: realtime-ws-push
    content: "Add WebSocket /v1/realtime to routing service. Replace HTTP polling in dashboard/realtime/Index.vue."
    status: pending
  - id: recording-minio-wire
    content: "Wire MinIO file write in services/recording. Without this call recordings are metadata-only (TRD TR-16 BLOCKER)."
    status: pending
  - id: docs-tests
    content: "docs/blinkone/TELEPHONY_CALLING.md, Meta prerequisites checklist, acceptance tests both transports."
    status: pending
isProject: true
---

# BlinkOne — Calling Agent View (Revised Plan)
## Review of Cursor-Generated Plan

> **Bottom line:** The Cursor plan is architecturally correct and well-structured.  
> It correctly identifies dual-transport (WhatsApp API + Asterisk/JsSIP), inbox-first UX matching Respond.io,  
> and the right component breakdown. **However it has 6 significant gaps and 3 errors vs your TRD and codebase.**  
> This document lists every issue and provides the corrected, executable plan.

---

## ✅ What the Cursor Plan Gets Right

| Item | Why It's Correct |
|------|-----------------|
| Dual transport architecture | TRD TR-06 requires Voice Inbound & Outbound. WhatsApp (TR-07) + PSTN (TR-06) are both mandatory. |
| Inbox-first UX (Chats/Calls tabs) | Matches TRD TR-11 — unified agent interface. Respond.io model is the right reference. |
| `call_sessions` + `call_events` schema | Correct — existing `services/calls` DB has no `conversation_id`, `transport`, or `call_events`. Needs extension. |
| `ConversationCallBar` + `CallActivitiesPanel` | Right component split. TRD TR-11 (unified UI), TR-18 (performance tracking). |
| `useJsSipAgent` composable for PSTN leg | Correct pattern. JsSIP UA connects to Asterisk 8089 WSS. |
| `useWhatsAppCall` for WA leg | Correct — Meta Calling uses `RTCPeerConnection` (SDP exchange), NOT JsSIP. Important distinction. |
| Action Cable for real-time push | Correct use of existing Chatwoot ActionCable infrastructure. |
| Phase ordering (Foundation → PSTN → WA → Polish) | Correct — Meta approval can take weeks; don't block PSTN on it. |
| `services/whatsapp-calls` as new service | Correct — keeps WA calling isolated from core routing. |
| Channel picker in compose area | Correct — matches TRD TR-11 unified interface requirement. |

---

## ❌ Errors & Gaps in the Cursor Plan

### ERROR 1 — nginx WSS proxy is MISSING (Critical Blocker)
**What Cursor said:** "nginx WSS, `pnpm add jssip`"  
**Reality:** The current `nginx/nginx.conf` has **NO** `location /telephony/wss` block. Asterisk port 8089 is exposed in `docker-compose.telephony.yml` but not proxied through nginx. JsSIP in the browser will fail to connect.  
**Fix required:**
```nginx
# ADD to nginx/nginx.conf inside the http → server block:
location /telephony/wss {
  proxy_pass         https://blinkone-asterisk:8089/ws;
  proxy_http_version 1.1;
  proxy_set_header   Upgrade $http_upgrade;
  proxy_set_header   Connection "upgrade";
  proxy_set_header   Host $host;
  proxy_read_timeout 86400;
  # TLS passthrough — Asterisk uses self-signed cert in dev
  proxy_ssl_verify   off;
}
```

---

### ERROR 2 — `GET /v1/agents/:id/webrtc` does NOT exist yet
**What Cursor said:** "Reuse Prompt 5 stack — routing `GET /v1/agents/:id/webrtc`"  
**Reality:** Grepping the routing service reveals this endpoint was planned but never built. The routing `src/server.js` has presence, queues, route/request, route/assign, route/complete — but NO `/webrtc` endpoint.  
**Fix required:** Add to `services/routing/src/server.js`:
```js
// GET /v1/agents/:id/webrtc — return JsSIP credentials
app.get('/v1/agents/:id/webrtc', auth, (req, res) => {
  ok(res, {
    wsUri: process.env.AST_WSS_URI || 'wss://localhost/telephony/wss',
    sipUri: `sip:${req.params.id}@${process.env.AST_WSS_DOMAIN || 'blinkone.local'}`,
    password: process.env.AST_AGENT_SIP_PASS || 'blinkone-agent-dev',
    stunServers: (process.env.STUN_SERVERS || 'stun:stun.l.google.com:19302').split(','),
    turnServers: process.env.TURN_SERVER ? [{
      urls: process.env.TURN_SERVER,
      username: process.env.TURN_USER || '',
      credential: process.env.TURN_PASS || ''
    }] : []
  });
});
```

---

### ERROR 3 — `call_sessions` schema extension conflicts with existing Postgres table
**What Cursor said:** "Extend or wrap `services/calls`"  
**Reality:** `services/calls/db/001_call_sessions.sql` already creates `call_sessions` in Postgres. The plan must NOT drop/recreate this table (TRD hard rule: no destructive migrations). It needs an **additive migration**:
```sql
-- services/calls/db/002_calling_extension.sql  (ADD ONLY — no DROP)
ALTER TABLE call_sessions
  ADD COLUMN IF NOT EXISTS conversation_id  TEXT,
  ADD COLUMN IF NOT EXISTS contact_id       TEXT,
  ADD COLUMN IF NOT EXISTS transport        TEXT NOT NULL DEFAULT 'pstn'
    CHECK (transport IN ('pstn', 'whatsapp')),
  ADD COLUMN IF NOT EXISTS direction        TEXT NOT NULL DEFAULT 'inbound'
    CHECK (direction IN ('inbound', 'outbound'));

CREATE TABLE IF NOT EXISTS call_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  call_session_id UUID REFERENCES call_sessions(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  actor_id        TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_events_session ON call_events (call_session_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_call_sessions_conversation ON call_sessions (tenant_id, conversation_id);
```

---

### ERROR 4 — tickets service MUST be migrated to Postgres FIRST (Cursor plan ignores this)
**What Cursor said:** Nothing about tickets-service migration.  
**Reality:** `services/tickets/src/server.js` uses a **flat-file JSON store** (`lib/store.js`). The Cursor plan links calls to `conversation_id` but tickets (cases) are also linked to conversations. If tickets is still on flat-file when call integration lands, you'll have CDR data in Postgres and ticket data in JSON — impossible to join.  
**Fix:** The tickets Postgres migration (see TRD gap doc P1-A) MUST be completed before or in parallel with Phase 1 of this plan.

---

### ERROR 5 — Missing Feature Flags (blinkone.telephony.enabled, calling.pstnEnabled)
**What Cursor said:** Mentions `blinkone.telephony.enabled` once but doesn't specify where it's read from or how it's set.  
**Reality:** Currently `PhonePanel.vue` has a comment `// JsSIP: connect when blinkone.telephony.enabled (step 9+)` — it's never actually checked. No feature flag API exists in `tenant-service` for this.  
**Fix required:** 
- Add `blinkone.calling.pstnEnabled` and `blinkone.calling.whatsappEnabled` to `tenant-service` features table
- Expose `GET /v1/tenants/:id/features` 
- In all calling Vue components: `const { features } = useBlinkoneApi(); if (!features.callingPstnEnabled) return null;`

---

### ERROR 6 — realtime-events plan uses Action Cable only (WebSocket push to routing is missing)
**What Cursor said:** "Action Cable channel `BlinkoneCallChannel`"  
**Reality:** Action Cable works for Chatwoot→agents notifications. But the **routing service real-time queue stats** (agent states, queue depth) that the Calls workspace page needs are in `services/routing` — NOT in Chatwoot's Rails app. The routing service currently has HTTP-poll only (confirmed in gap doc). You need BOTH:
1. **ActionCable** for Chatwoot-side notifications (incoming call ring, call ended)
2. **WebSocket on routing service** for live queue stats and agent presence (add to `services/routing`)

---

### GAP — MinIO Recording write is not in the Cursor plan
**TRD TR-16 is MANDATORY.** The Cursor plan mentions "Call recordings playback in Phase 4" but the underlying MinIO write has never been wired. Recording metadata is stored but audio is never saved. This must be in Phase 1 or Phase 2, not Phase 4 — otherwise Phase 4 "playback" has nothing to play.

---

### GAP — No RBAC guard on calling endpoints
**TRD TR-41/TR-56:** The plan adds new endpoints (`/v1/calls/*`, `/v1/agents/:id/webrtc`) but doesn't specify role guards. Minimum:
- `answer`, `hangup`, `transfer` → require `agent` role
- `supervise`, `barge` → require `supervisor` role  
- All calls → `tenant_id` filter enforced

---

## Corrected Architecture

```
[ Browser Agent ]
       │
       ├─ ActionCable (Chatwoot /cable) ──→ BlinkoneCallChannel (incoming ring)
       ├─ WSS /telephony/wss ─────────────→ Asterisk :8089 (JsSIP PSTN leg)
       └─ REST /api/calls/* ──────────────→ gateway → services/calls (call_sessions)
                                                     ↕ call_events
       ├─ WS /api/routing/v1/realtime ────→ routing service (queue stats)
       └─ RTCPeerConnection (WA leg) ──────→ services/whatsapp-calls → Meta API

[ services/calls ] ← extend with conversation_id, transport, call_events
[ services/routing ] ← add /webrtc creds endpoint + WS realtime
[ nginx.conf ] ← add /telephony/wss WSS proxy block  ← MISSING TODAY
[ tenant-service ] ← add feature flags for calling
[ services/whatsapp-calls ] ← NEW (Phase 3, after Meta approval)
```

---

## Corrected Implementation Phases

### Phase 0 — Pre-requisites (1 week) — DO FIRST
> These must be done before any calling UI work. Cursor plan skips these entirely.

| Task | File(s) | TRD |
|------|---------|-----|
| Migrate tickets to Postgres | `services/tickets/db/001_tickets.sql` + `lib/ticket-repo.js` | TR-22 |
| Add nginx WSS proxy for Asterisk | `nginx/nginx.conf` | TR-06 |
| Add feature flags to tenant-service | `services/tenant/db/` + API endpoint | TR-41 |
| Add `GET /v1/agents/:id/webrtc` to routing | `services/routing/src/server.js` | TR-06 |

---

### Phase 1 — Foundation & PSTN (2–3 weeks)

| Task | File(s) | TRD |
|------|---------|-----|
| Additive DB migration for call_sessions | `services/calls/db/002_calling_extension.sql` | TR-06 |
| Create `call_events` table | same migration file | TR-18 |
| Unified calls REST API | `services/calls/src/server.js` — add `/v1/calls` CRUD | TR-06 |
| Expose via gateway | `services/gateway/src/proxy/` — route `/api/calls/*` | TR-46 |
| `useJsSipAgent.js` composable | `chatwoot-fork-overlay/.../Calling/useJsSipAgent.js` | TR-06 |
| `ConversationCallBar.vue` (PSTN) | `blinkone_components/Calling/ConversationCallBar.vue` | TR-11 |
| `CallActivitiesPanel.vue` | `blinkone_components/Calling/CallActivitiesPanel.vue` | TR-11 |
| Inbox Chats/Calls tabs patch | `scripts/blinkone/patch-chatwoot-calling-inbox.mjs` | TR-11 |
| BlinkoneCallChannel (ActionCable) | `chatwoot-fork-overlay/app/channels/` | TR-11 |
| MinIO recording write worker | `services/recording/lib/minio-worker.js` | TR-16 **BLOCKER** |
| WebSocket /v1/realtime in routing | `services/routing/lib/realtime-ws.js` | TR-19 |

---

### Phase 2 — Supervisor & Monitoring (1–2 weeks)

| Task | File(s) | TRD |
|------|---------|-----|
| Wire supervisor whisper/barge to Asterisk AMI | `services/routing/lib/supervise.js` — add AMI commands | TR-17 |
| Supervisor WebSocket session | `services/routing/src/server.js` — WS `/v1/supervise/session` | TR-17 |
| Agent screen-pop on PSTN ring | `useJsSipAgent.js` → emit `conversation.open` via Chatwoot store | TR-11 |
| RBAC guards on all call routes | `services/_shared/rbac.js` — agent/supervisor/admin roles | TR-41 |
| Calls workspace page (PSTN) | `blinkone_components/telephony/routing/Index.vue` extend | TR-19 |
| `ChannelCallPicker.vue` | `blinkone_components/Calling/ChannelCallPicker.vue` | TR-11 |

---

### Phase 3 — WhatsApp Calling API (2–3 weeks, needs Meta approval first)

> ⚠️ Prerequisites: Meta Business Portfolio approved for Calling feature, WABA messaging limit Level 2+, HTTPS webhook registered with Meta.

| Task | File(s) | TRD |
|------|---------|-----|
| `services/whatsapp-calls/` — new service | `services/whatsapp-calls/src/server.js` | TR-07 |
| Meta webhook receiver | `services/whatsapp-calls/lib/meta-webhook.js` | TR-07 |
| SDP relay (browser RTCPeerConnection ↔ Meta) | `services/whatsapp-calls/lib/sdp-relay.js` | TR-07 |
| `useWhatsAppCall.js` composable | `blinkone_components/Calling/useWhatsAppCall.js` | TR-07 |
| `useCallSession.js` — transport picker | `blinkone_components/Calling/useCallSession.js` | TR-11 |
| WA call permission button | In `ConversationBox` overlay — "Request Call Permission" CTA | TR-07 |
| Gateway route `/api/whatsapp-calls/*` | `services/gateway/src/proxy/` | TR-46 |
| `WHATSAPP_CALLING_ENABLED` env flag | `.env.example` + feature flag check | TR-40 |
| Inbox answer/decline for WA transport | Extend inbox calls tab component | TR-11 |

---

### Phase 4 — Recording Playback & AI (1–2 weeks)

| Task | File(s) | TRD |
|------|---------|-----|
| Recording playback in CallActivitiesPanel | Use signed URL from `services/recording` | TR-16 |
| Post-call STT trigger | `services/ai` STT job on call end event | TR-35 |
| Transcript display in activity card | `CallActivitiesPanel.vue` | TR-35 |
| Agent transfer (PSTN + WA if Meta supports) | routing + whatsapp-calls transfer endpoint | TR-17 |
| Excel/PDF CDR export | `services/routing` + `services/calls` report endpoints | TR-68 |

---

## Key Files — Complete List

| Area | Path | New/Modify |
|------|------|-----------|
| nginx WSS proxy | `nginx/nginx.conf` | **MODIFY** (currently missing) |
| Tickets Postgres migration | `services/tickets/db/001_tickets.sql` | **NEW** |
| Call sessions extension | `services/calls/db/002_calling_extension.sql` | **NEW** |
| Call events table | same file | **NEW** |
| Calls REST API extend | `services/calls/src/server.js` | **MODIFY** |
| WebRTC creds endpoint | `services/routing/src/server.js` | **MODIFY** |
| Routing realtime WS | `services/routing/lib/realtime-ws.js` | **NEW** |
| MinIO recording worker | `services/recording/lib/minio-worker.js` | **NEW** |
| Feature flags API | `services/tenant/src/server.js` | **MODIFY** |
| Gateway calls route | `services/gateway/src/proxy/proxy.service.ts` | **MODIFY** |
| Gateway WA-calls route | same | **MODIFY** (Phase 3) |
| WA calling service | `services/whatsapp-calls/src/server.js` | **NEW** (Phase 3) |
| Meta webhook lib | `services/whatsapp-calls/lib/meta-webhook.js` | **NEW** (Phase 3) |
| SDP relay lib | `services/whatsapp-calls/lib/sdp-relay.js` | **NEW** (Phase 3) |
| useJsSipAgent | `chatwoot-fork-overlay/.../Calling/useJsSipAgent.js` | **NEW** |
| useWhatsAppCall | `chatwoot-fork-overlay/.../Calling/useWhatsAppCall.js` | **NEW** (Phase 3) |
| useCallSession | `chatwoot-fork-overlay/.../Calling/useCallSession.js` | **NEW** |
| ConversationCallBar | `chatwoot-fork-overlay/.../Calling/ConversationCallBar.vue` | **NEW** |
| CallActivitiesPanel | `chatwoot-fork-overlay/.../Calling/CallActivitiesPanel.vue` | **NEW** |
| ChannelCallPicker | `chatwoot-fork-overlay/.../Calling/ChannelCallPicker.vue` | **NEW** |
| Inbox calling patch | `scripts/blinkone/patch-chatwoot-calling-inbox.mjs` | **NEW** |
| ActionCable channel | `chatwoot-fork-overlay/app/channels/blinkone_call_channel.rb` | **NEW** |
| Calls routes | `chatwoot-fork-overlay/.../blinkone/calls.routes.js` | **NEW** |
| i18n EN | `chatwoot-fork-overlay/.../locale/en/blinkone_overrides.json` | **MODIFY** |
| i18n AR | `chatwoot-fork-overlay/.../locale/ar/blinkone_overrides.json` | **MODIFY** |
| Env example | `.env.example` | **MODIFY** |
| Docs | `docs/blinkone/TELEPHONY_CALLING.md` | **NEW** |

---

## TRD Requirements Covered by This Plan

| TR-ID | Requirement | Covered in Phase |
|-------|-------------|-----------------|
| TR-06 | Voice Inbound & Outbound | Phase 1 (PSTN) + Phase 3 (WA) |
| TR-07 | WhatsApp Business API integration | Phase 3 |
| TR-11 | Unified agent interface | Phase 1 |
| TR-12 | IVR (already exists) | Phase 0 — just wire |
| TR-13 | ACD routing | Phase 0 (webrtc creds) |
| TR-16 | Call recording | Phase 1 (MinIO write) |
| TR-17 | Supervisor whisper/barge | Phase 2 |
| TR-18 | Agent performance tracking | Phase 1 (call_events) |
| TR-19 | Real-time dashboards | Phase 1 (WS push) |
| TR-35 | Speech-to-text | Phase 4 (post-call STT) |
| TR-41 | Role-based access per tenant | Phase 2 (RBAC guards) |
| TR-46 | REST API | Phase 1 (gateway routes) |
| TR-68 | Export to Excel/PDF | Phase 4 |

---

## Cursor Plan: Final Verdict

| Aspect | Rating | Notes |
|--------|--------|-------|
| Overall architecture | ✅ Good | Dual transport, inbox-first — correct |
| WhatsApp vs SIP distinction | ✅ Correct | Meta uses SDP/WebRTC not JsSIP — important |
| Phase ordering | ✅ Good | Foundation before WA (Meta takes time) |
| nginx WSS proxy | ❌ Missing | Must add before JsSIP can work AT ALL |
| WebRTC creds endpoint | ❌ Missing | Endpoint doesn't exist in routing yet |
| DB migration safety | ⚠️ Risky | Plan says "extend" without specifying additive SQL — could be destructive |
| Tickets migration dependency | ❌ Ignored | Flat-file store blocks full integration |
| Feature flags | ⚠️ Vague | Mentioned once, not specified where/how |
| MinIO recording | ❌ Phase 4 only | TRD TR-16 is mandatory — must move to Phase 1 |
| RBAC guards | ❌ Missing | No role enforcement on new calling endpoints |
| Real-time (routing WS) | ⚠️ Partial | ActionCable alone is not enough — routing needs its own WS |

**Safe to execute?** Execute the REVISED plan above, not the original. The original plan will fail at Phase 2 step 1 because nginx has no WSS proxy and the webrtc creds endpoint doesn't exist.

---

## How to Use This with Cursor

Paste this to Cursor when starting each phase:

```
I am working on BlinkOne (see .cursorrules for all rules).
I want to implement Phase [X] of the calling agent view plan.
The plan is in calling_agent_view_REVISED.plan.md.

Start with task: [task name from the phase table]
Show me the OpenAPI spec or SQL migration FIRST before writing any implementation.
```

Do NOT paste all phases at once — Cursor will try to build everything in one shot and create conflicts.
