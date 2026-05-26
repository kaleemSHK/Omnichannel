# BlinkOne — 10-Domain Codebase Audit
**Date:** 2026-05-26  
**Auditor:** Claude Code (Solution Architect)  
**Method:** Full file-level inspection of all 14 services + frontend

---

## Scoring Key
- ✅ Implemented and production-ready
- ⚠️ Partially implemented / needs work  
- ❌ Missing / stub only

---

## Domain 1 — Chatwoot Customization & Private Labeling

| Item | Status | Notes |
|------|--------|-------|
| Chatwoot SCSS token override (`_blinkone-tokens.scss`) | ✅ | BlinkOne brand tokens wired into Chatwoot |
| Branding engine (`services/platform/lib/branding.js`) | ✅ | YAML-based, per-tenant overrides, logo URLs |
| Tenant branding API (`GET/PATCH /v1/tenants/:id/branding`) | ✅ | `services/tenant/src/server.js` |
| Chatwoot Vue component overlays | ✅ | Admin audit, billing, branding, SSO Vue stubs |
| **Next.js branding settings UI** | ❌ | Backend exists, no frontend settings panel |
| **Runtime CSS variable injection** | ❌ | Primary/secondary color not applied live in Next.js |
| **Logo upload endpoint** | ❌ | No file upload API for branding assets |
| Per-tenant subdomain routing | ✅ | `services/tenant/lib/resolve-host.js` |
| ACME/TLS for custom domains | ✅ | `services/tenant/lib/acme.js` |

**Risk:** Customers see "BlinkOne" branding and default colors with no way to customize from the Next.js admin.

**Next step:** Implement branding settings panel in `frontend/src/components/settings/`.

---

## Domain 2 — Multi-Tenancy Architecture

| Item | Status | Notes |
|------|--------|-------|
| Tenant isolation in all services | ✅ | `tenant_id` on every query |
| Feature flags per tenant | ✅ | `_shared/lib/features.js`, 60s TTL cache |
| Tenant provisioning API | ✅ | `services/tenant/` — full CRUD |
| Tenant suspension middleware | ✅ | `services/routing/lib/tenant-guard.js` |
| **Rate limiting per tenant** | ❌ | No `express-rate-limit` anywhere |
| **Platform admin tenant wizard** | ❌ | API exists, no frontend UI |
| Feature flag admin UI | ⚠️ | Settings page has feature section, not fully wired |
| Multi-region data residency | ❌ | Single DB, not planned |

**Risk:** No rate limiting means one misbehaving tenant can DoS others.

**Next step:** Add `express-rate-limit` to gateway (Sprint 1 G11).

---

## Domain 3 — Authentication & User Management

| Item | Status | Notes |
|------|--------|-------|
| Chatwoot JWT auth at gateway | ✅ | All services validate via gateway headers |
| RBAC roles (agent/supervisor/admin/platform_admin) | ✅ | `frontend/src/lib/rbac.ts` + `roles.ts` |
| Keycloak SSO integration | ⚠️ | `services/integration/lib/keycloak.js` — functional but `KEYCLOAK_STUB=1` in dev |
| SSO settings UI (Chatwoot Vue stub) | ⚠️ | Vue component exists, Next.js UI missing |
| **MFA (TOTP/SMS)** | ❌ | Not implemented anywhere |
| **Password reset flow** | ❌ | Delegated to Chatwoot only |
| **Session management / force logout** | ❌ | No active session list |
| API key management for agents | ❌ | Not implemented (G19 in arch doc) |
| Audit log for auth events | ⚠️ | `services/integration/lib/audit.js` exists, not wired to auth events |

**Risk:** No MFA in a CCaaS platform with voice recordings and customer data is a compliance liability.

**Next step:** Wire Keycloak OIDC properly; add TOTP as second factor.

---

## Domain 4 — WhatsApp Cloud API Integration

| Item | Status | Notes |
|------|--------|-------|
| Meta webhook verification (hub.challenge) | ✅ | `services/whatsapp-calls/lib/meta-webhook.js` |
| WhatsApp Calling webhook (WABA Voice) | ⚠️ | SDP relay exists, `WHATSAPP_CALLING_ENABLED=0` |
| **WhatsApp Messaging webhook handler** | ❌ | `meta-webhook.js` only handles calling events, not text/media messages |
| **Incoming message → Chatwoot conversation** | ❌ | No bridge between Meta webhook and Chatwoot |
| **Send WhatsApp text message** | ❌ | No `POST /messages` to Meta Graph API |
| **Send WhatsApp template message** | ❌ | No template sender |
| **Media message handling** | ❌ | No image/video/document processing |
| **Message status callbacks (delivered/read)** | ❌ | Webhook parses no status events |
| **Phone number verification flow** | ❌ | No OTP verification UI |
| WhatsApp inbox setup wizard (frontend) | ✅ | `InboxCreateWizard.tsx` supports `Channel::Whatsapp` |
| WHATSAPP_PHONE_NUMBER_ID env var | ❌ | Not in `.env.example` |

**Risk:** WhatsApp is listed as a key feature in all marketing materials. Current codebase cannot send or receive a single WhatsApp message.

**Next step:** Implement WhatsApp Cloud API backend (message relay → Chatwoot + send API).

---

## Domain 5 — Omni-Channel Inbox Architecture

| Item | Status | Notes |
|------|--------|-------|
| Web widget inbox | ✅ | Chatwoot native |
| Email inbox | ✅ | Chatwoot native |
| SMS/Twilio inbox | ✅ | Chatwoot native |
| Voice inbox | ✅ | `services/calls/` + JsSIP |
| WhatsApp inbox (Chatwoot) | ⚠️ | Config UI exists, backend stub |
| API inbox | ✅ | Chatwoot native |
| **Inbox create wizard** | ✅ | `InboxCreateWizard.tsx` — 3-step wizard |
| **WhatsApp channel config fields** | ⚠️ | `ChannelConfigFields.tsx` — needs phone_number_id + access_token |
| Unified conversation timeline | ✅ | Chatwoot handles this natively |
| Cross-channel routing (voice → WhatsApp) | ❌ | Not implemented |

**Risk:** WhatsApp inbox exists in UI but backend integration is a stub.

---

## Domain 6 — AI Chatbot Integration

| Item | Status | Notes |
|------|--------|-------|
| RAG knowledge base (pgvector) | ✅ | `services/ai/lib/rag/service.js` |
| Whisper STT | ✅ | `services/ai/lib/stt/adapter.js` + `whisper.js` |
| Piper TTS | ✅ | `services/ai/lib/tts/piper.js` |
| OpenAI LLM adapter | ✅ | `services/ai/lib/llm/openai-adapter.js` |
| Voicebot FSM | ✅ | `services/ai/lib/voicebot/fsm.js` |
| Agent Assist panel (Vue) | ✅ | `AgentAssistPanel.vue` overlay |
| AI knowledge workspace (Next.js) | ✅ | `AIKnowledgeWorkspace.tsx` |
| **Bot routing rules (assign bot to inbox)** | ❌ | `BotsSection.tsx` exists but content unknown |
| **Bot → human agent handoff** | ❌ | No escalation trigger from AI to live agent |
| **WhatsApp AI bot** | ❌ | No bot engine for WhatsApp channel |
| PII redaction in transcripts | ❌ | G09 in arch doc |
| Speech analytics (sentiment/topics) | ❌ | G09 in arch doc |

**Risk:** Voicebot works for IVR but there's no chatbot flow for WhatsApp/web channel.

---

## Domain 7 — CRM & Ticketing Modules

| Item | Status | Notes |
|------|--------|-------|
| Ticket CRUD with custom fields | ✅ | `services/tickets/` + DB migrations |
| SLA policies and breach events | ✅ | `services/sla/` |
| Escalation engine | ✅ | `services/escalation/` |
| Contact timeline | ✅ | Frontend components present |
| CDR linkage to contacts | ⚠️ | `conversationId` on CallSession but not always populated |
| **Email threading (inbound → ticket reply)** | ❌ | G10 in arch doc |
| **Ticket attachments** | ❌ | Not implemented |
| **Ticket ↔ Chatwoot conversation link** | ❌ | No bi-directional sync |
| CRM contact enrichment | ❌ | Not planned yet |

**Risk:** Tickets exist as standalone module but are disconnected from conversations.

---

## Domain 8 — Voice Bot & IVR/Asterisk Integration

| Item | Status | Notes |
|------|--------|-------|
| IVR flow builder (graph-based) | ✅ | `services/ivr/` with version history |
| Twilio voicebot router | ✅ | `services/ivr/lib/twilio-voicebot.js` |
| ARI (Asterisk) bridge | ✅ | `services/ivr/src/ari-app.js`, `bridge.js` |
| Voicebot FSM (STT → LLM → TTS) | ✅ | Working with Arabic + English |
| IVR flow editor (frontend) | ✅ | Frontend IVR section present |
| **WhatsApp IVR flow node** | ❌ | G14 in arch doc |
| **A/B testing between flow versions** | ❌ | Not implemented |
| **Transfer to agent with skill requirement** | ❌ | IVR can transfer to queue but not specify skill |

**Risk:** IVR is functional but skill-aware transfers are missing.

---

## Domain 9 — Mobile/WebRTC Calling

| Item | Status | Notes |
|------|--------|-------|
| JsSIP WebRTC calling | ✅ | `useJsSip.ts` — full lifecycle |
| Kamailio WSS bridge (Twilio) | ✅ | `kamailio-twilio-wss.cfg` |
| DTMF (in-call digit tones) | ✅ | `session.sendDTMF()` with visual flash |
| Hold/mute/blind transfer | ✅ | All implemented |
| Call recording (Minio) | ✅ | `services/recording/` |
| STUN/TURN via WebRTC credentials | ✅ | `/v1/agents/:id/webrtc` |
| Incoming call toast | ✅ | `IncomingCallToast.tsx` |
| ACW (After Call Work) notes | ✅ | `CallNotesModal.tsx` |
| MOS voice quality scoring | ❌ | Sprint 1 G03 — not yet implemented |
| PCI Recording Pause | ❌ | Sprint 1 G02 — UI stub, no backend |
| **Mobile app (React Native)** | ❌ | Browser-only WebRTC |
| **Push notifications for incoming calls** | ❌ | No FCM/APNs integration |

**Risk:** All calling is browser-only. No mobile agent app.

---

## Domain 10 — Deployment, Docker, CI/CD, Monitoring, Security

| Item | Status | Notes |
|------|--------|-------|
| Docker Compose (all services) | ✅ | `docker-compose.yml` — 14+ services |
| PM2 frontend process manager | ✅ | `ecosystem.config.cjs` + deploy script |
| GitHub Actions CI | ⚠️ | `blinkone-ci.yml` covers only gateway/shared — NOT frontend, calls, AI, routing, etc. |
| Deploy script (`restart_frontend_standalone.sh`) | ✅ | Full 5-step deploy with static asset fix |
| **CI: frontend TypeScript check** | ❌ | Not in any workflow |
| **CI: all services lint+test** | ❌ | Only gateway covered |
| **Monitoring (Prometheus/Grafana)** | ❌ | No metrics endpoints, no dashboards |
| **Alerting** | ❌ | No PagerDuty/alertmanager setup |
| **Log aggregation (Loki/ELK)** | ❌ | Services log to stdout only |
| PII log masking | ❌ | Sprint 1 G07 — not yet implemented |
| Rate limiting at gateway | ❌ | G11 — not implemented |
| Input validation (Zod) | ⚠️ | Inconsistent across services |
| CORS configuration | ⚠️ | Need per-service audit |
| Secret rotation procedure | ❌ | No documented process |

**Risk:** CI only covers 2 of 14 services. Any regression in calls/AI/routing services won't be caught automatically.

---

## Priority Matrix (Updated)

| ID | Feature | Domain | Priority | Effort | Sprint |
|----|---------|--------|----------|--------|--------|
| W01 | WhatsApp Cloud API messaging | 4 | **P0** | 4d | S1 |
| G07 | PII log masking | 10 | **P0** | 1d | S1 |
| B01 | Branding settings UI | 1 | P1 | 2d | S1 |
| CI1 | Extend CI to all services + frontend | 10 | P1 | 1d | S1 |
| G02 | PCI Recording Pause backend | 9 | P1 | 3d | S1 |
| G03 | MOS voice quality scoring | 9 | P1 | 2d | S1 |
| G11 | Rate limiting (gateway) | 2/10 | P1 | 1d | S1 |
| G05 | Predictive Dialer | 9 | P1 | 8d | S2 |
| A01 | Bot routing rules + handoff | 6 | P1 | 3d | S2 |
| T01 | Ticket ↔ conversation link | 7 | P2 | 2d | S2 |
| M01 | MFA (TOTP) | 3 | P2 | 3d | S3 |
| S01 | Speech analytics pipeline | 6 | P2 | 5d | S3 |
| E01 | Email threading | 7 | P2 | 4d | S3 |
| IVR1 | Skill-aware IVR transfer | 8 | P2 | 1d | S2 |
| MON1 | Prometheus metrics + Grafana | 10 | P2 | 3d | S3 |

---

## Implementation Order (Next 5 Actions)

1. **W01** — WhatsApp Cloud API backend (P0 — feature completely missing)
2. **CI1** — Extend CI to all services + frontend TypeScript (P1 — safety net for everything else)
3. **G07** — PII log masking (P0 — security/compliance required NOW)
4. **B01** — Branding settings UI (P1 — customer-facing, backend already done)
5. **G11** — Rate limiting at gateway (P1 — 1 day, prevents DoS)
