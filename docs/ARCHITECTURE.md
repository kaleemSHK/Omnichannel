# BlinkOne — Solution Architecture Document
**Version:** 1.0 — 2026-05-26  
**Author:** Claude Code (Solution Architect role)  
**Audience:** Cursor AI, all developers, DevOps

---

## 0. How to Use This Document

This document is the **single source of truth** for BlinkOne architecture decisions. Before writing any code:

1. Read the relevant module section
2. Read the gap analysis for that module
3. Follow the ADR (Architecture Decision Record) in the appropriate section
4. After implementation, a Senior Code Review pass validates against the standards in §9

---

## 1. System Overview

BlinkOne is a **multi-tenant CCaaS (Contact Center as a Service)** platform built on top of Chatwoot. It extends Chatwoot with:
- SIP/WebRTC voice calling (Kamailio + JsSIP)
- AI/voicebot (Whisper STT, Piper TTS, OpenAI LLM, pgvector RAG)
- Skills-based routing + queue management
- IVR flow builder
- Recording (Minio object storage)
- Multi-channel tickets + SLA
- Escalation engine
- Tenant/billing management

### 1.1 Deployment Topology

```
Internet
   │
   ▼
nginx (443/80)     ─── app.blinksone.com ──▶ :3001  Next.js (PM2)
                   ─── ws.blinksone.com  ──▶ :8787  Gateway (NestJS)
                   ─── sip.blinksone.com ──▶ :5060/:7443 Kamailio
                   ─── chatwoot.blinksone.com ──▶ :3000 Chatwoot Rails
   │
   ▼ Private network (Docker overlay / host)
┌────────────────────────────────────────────────────────────────────┐
│  gateway      :8787  NestJS  — auth proxy, websocket hub           │
│  platform     :8790  Node    — agents, inboxes, contacts           │
│  calls        :8792  Node    — call sessions, CDR, routing bridge  │
│  routing      :8798  Node    — SBR, queues, overflow, wallboard    │
│  recording    :8799  Node    — audio upload/stream, Minio          │
│  ivr          :8795  Node    — flow builder, Twilio voicebot       │
│  ai           :8793  Node    — RAG, STT, TTS, LLM assist          │
│  tickets      :8791  Node    — ticket CRUD, SLA, fields            │
│  sla          :8796  Node    — SLA policies, breach events         │
│  escalation   :8797  Node    — rule engine, alert dispatcher       │
│  tenant       :8802  Node    — tenant CRUD, feature flags          │
│  whatsapp-calls :8803 Node   — WhatsApp Business API bridge        │
│  billing      :8804  Node    — subscription, metering              │
│  integration  :8805  Node    — webhook adapters (Zapier, etc.)     │
│                                                                      │
│  PostgreSQL   :5432  — Chatwoot DB (primary)                       │
│  PostgreSQL   :5433  — BlinkOne DB (pgvector, tickets, SBR)        │
│  Redis        :6379  — queue state, agent presence, pub/sub        │
│  Minio        :9000  — recording audio, AI training data           │
│  Kamailio     :5060/:7443  — SIP registrar + Twilio WSS bridge     │
└────────────────────────────────────────────────────────────────────┘
```

### 1.2 Front-End Architecture

```
Next.js 14 App Router (standalone)
├── app/
│   ├── (dashboard)/
│   │   ├── calling/          — CallingWorkspace, DialPad, PhonePanel
│   │   ├── conversations/    — Chatwoot iframe + BlinkOne overlays
│   │   ├── contacts/         — CRM panel, contact timeline
│   │   ├── tickets/          — Ticket list, detail, SLA badge
│   │   ├── routing/          — Queue admin, wallboard, SBR config
│   │   ├── ivr/              — IVR flow builder
│   │   ├── ai/               — RAG knowledge workspace, query tester
│   │   ├── reports/          — CDR, SLA, AI reports
│   │   ├── settings/         — Feature flags, tenant config
│   │   └── layout.tsx        — Nav + PhonePanel (global)
│   └── api/                  — Next.js route handlers (thin proxies only)
├── components/               — Presentational, domain-grouped
├── lib/
│   ├── api/                  — fetch wrappers per service
│   ├── store/                — Zustand: auth, calls, inbox
│   ├── hooks/                — React Query + Zustand hooks per domain
│   └── utils/                — cn, phone, calling helpers
└── types/index.ts            — Shared TypeScript interfaces
```

---

## 2. Service Contract Standards

All BlinkOne microservices MUST follow these contracts:

### 2.1 REST API Shape
```json
// Success
{ "data": <payload>, "meta": { "requestId": "...", "ts": "ISO8601" } }

// Error
{ "error": { "code": "SNAKE_CASE_CODE", "message": "Human readable" }, "meta": { "requestId": "..." } }
```

### 2.2 Auth
- Service-to-service: `Authorization: Bearer <INTERNAL_TOKEN>` (env `TOKEN`)
- Frontend-to-gateway: JWT from Chatwoot login (`Authorization: Bearer <jwt>`)
- Gateway validates JWT, adds `x-blinkone-tenant-id` and `x-blinkone-agent-id` headers downstream

### 2.3 Multi-tenancy
- Every resource row carries `tenant_id` (= Chatwoot account ID)
- Every query MUST filter by tenant — no cross-tenant data leakage
- Middleware: `requireTenant(req)` → resolves from header or JWT claim

### 2.4 Feature Flags
- Gating via `requireFeature(featureKey, resolveTenantId, fail)` middleware
- Source of truth: `tenant` service at `:8802`
- Cache TTL: 60 s (configurable via `FEATURE_CACHE_MS`)

### 2.5 Logging
- All services use structured JSON via `createLogger(name)` (`pino`)
- Log levels: `error` (alerts), `warn` (actionable degradation), `info` (lifecycle events), `debug` (disabled in prod)
- NEVER log PII (phone numbers, customer names) without masking

---

## 3. Module-by-Module Architecture

### 3.1 Skills-Based Routing (SBR) — `services/routing`

**Current state:**
- Binary skill matching: agent either has skill or not
- No weighted proficiency scores (1–5)
- No skill-gap penalty in selection algorithm
- `selectionAlgorithm` supports `longest_idle` and `round_robin` only

**Target state (Sprint 1):**
- Skill proficiency 1–5 stored in agent record (`agentSkills: [{skill, proficiency}]`)
- Weighted selection: sum of matched skill proficiencies; higher = preferred
- New algorithm: `best_match` (weight-first, then longest_idle tiebreak)
- Skills Manager admin UI: add/remove skills, set proficiency per agent

**Data model (addition):**
```sql
-- In blinkone DB
CREATE TABLE agent_skills (
  id          SERIAL PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  skill       TEXT NOT NULL,
  proficiency SMALLINT NOT NULL DEFAULT 3 CHECK (proficiency BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, agent_id, skill)
);
CREATE INDEX idx_agent_skills_tenant_agent ON agent_skills(tenant_id, agent_id);
```

**Key files:**
- `services/routing/lib/selection.js` — `agentMatchesQueue()` + `selectAgent()`
- `services/routing/lib/redis-state.js` — `listAgentStates()`
- `services/routing/lib/agent-repo.js` — agent CRUD
- `services/routing/src/server.js` — REST routes

---

### 3.2 Recording Service — `services/recording`

**Current state:**
- Upload/store/stream audio to Minio ✅
- Presigned URL generation ✅
- PCI Recording Pause: **NOT IMPLEMENTED** (UI stub only)
- No DTMF digit masking in audio stream
- No audit log for pause/resume events

**Target state (Sprint 1):**
- `POST /v1/recordings/:id/pause-pci` → sets `pci_paused=true` in metadata
- `POST /v1/recordings/:id/resume-pci` → sets `pci_paused=false`
- Stores audit trail: `{ agentId, pausedAt, resumedAt, reason: 'pci_pause' }`
- During playback: silence injected for paused intervals (server-side WAV splice or client-side time range skip)
- Integration: calls service sends `DTMF_*` event → recording service pauses

**Key files:**
- `services/recording/src/server.js` — add pause/resume routes
- `services/recording/lib/store.js` — add pci_pauses array to recording record

---

### 3.3 Predictive Dialer — MISSING SERVICE

**Current state:** Does not exist anywhere in the codebase.

**Target architecture (Sprint 2):**
```
services/dialer/
├── src/server.js          — Express: campaign CRUD, dialer control
├── lib/
│   ├── campaign-repo.js   — campaign + contact list storage
│   ├── pacing-engine.js   — Erlang C pacing, abandon rate control
│   ├── amd.js             — Answering Machine Detection (SIP 183/AMD tone)
│   ├── dnc-list.js        — Do Not Call list checker
│   ├── call-launcher.js   — POST to calls service to initiate outbound
│   └── db.js
└── migrations/
    └── 001_create_campaigns.sql
```

**Pacing algorithm:** Start with conservative 1:1 (one dial per available agent). Add AMD callback support. Implement abandon rate cap at ≤ 3% (FCC compliant).

---

### 3.4 IVR Service — `services/ivr`

**Current state:**
- Flow builder with graph-based IVR ✅
- Twilio voicebot router ✅
- ARI (Asterisk REST Interface) bridge exists
- Version history per flow ✅

**Gap:**
- No WhatsApp IVR flow node type
- No "Transfer to agent with skill requirement" node
- No A/B testing between flow versions

---

### 3.5 AI Service — `services/ai`

**Current state:**
- RAG: pgvector semantic search, Arabic + English ✅
- STT: Whisper ✅
- TTS: Piper ✅
- LLM: OpenAI adapter ✅
- Voicebot FSM ✅

**Gap:**
- No speech analytics pipeline (sentiment, topic extraction per call)
- No agent assist "next best action" triggered from live transcript
- No PII redaction in transcript storage (phone numbers, card numbers appear in plain text)

---

### 3.6 Tickets Service — `services/tickets`

**Current state:**
- CRUD, custom fields, SLA integration ✅
- No email threading (inbound email → ticket reply)
- No attachment handling
- No ticket-to-conversation link (Chatwoot conversation ↔ BlinkOne ticket)

---

### 3.7 Gateway — `services/gateway`

**Current state:**
- NestJS reverse proxy
- JWT validation
- WebSocket hub for real-time events

**Gap:**
- No rate limiting per tenant
- No API key management (external developers / Zapier)
- No webhook delivery with retry logic

---

## 4. Database Architecture

### 4.1 Current Storage Reality

| Service    | Storage Type | Notes |
|-----------|-------------|-------|
| routing   | Redis (state) + File JSON (queues) | Should migrate queues to PG |
| recording | File JSON + Minio (audio) | Should migrate metadata to PG |
| ivr       | File JSON + optional PG | DB migrations exist |
| calls     | File JSON | Must migrate to PG for CDR reporting |
| tickets   | PG (via `BLINKONE_DATABASE_URL`) | Healthy |
| ai        | PG (pgvector) | Healthy |
| tenant    | PG | Healthy |

**P1 migration targets:** calls CDR, routing queues/agents, recording metadata → all to `BLINKONE_DATABASE_URL` postgres.

### 4.2 Schema Standards

```sql
-- Every table must have:
id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
tenant_id   TEXT NOT NULL,
created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

-- Index pattern:
CREATE INDEX ON table_name (tenant_id, created_at DESC);

-- Audit fields on mutable resources:
created_by  TEXT,   -- agent_id
updated_by  TEXT
```

---

## 5. Security Architecture

### 5.1 Current Security Posture

| Control | Status |
|---------|--------|
| Service auth (bearer token) | ✅ All services |
| JWT validation at gateway | ✅ |
| Multi-tenant isolation | ✅ At query level |
| PII in logs | ⚠️ Phone numbers logged unmasked in some services |
| PCI Recording Pause | ❌ Backend not implemented |
| Rate limiting | ❌ Not implemented |
| API audit log | ❌ Not implemented |
| CORS | ⚠️ Needs review per service |
| Input validation (Zod/Joi) | ⚠️ Inconsistent — some services use manual checks |

### 5.2 P1 Security Requirements

1. **PII log masking**: Regex mask on all pino logger output for phone numbers (`/\+?\d{10,15}/`) and card numbers (`/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/`)
2. **Rate limiting**: `express-rate-limit` at gateway: 100 req/min per tenant for standard, 1000 for premium
3. **Input validation**: Adopt `zod` schema validation at every POST/PATCH handler in all services
4. **PCI Recording Pause**: Implement before any live payment call handling

---

## 6. Frontend Architecture Standards

### 6.1 Component Rules

```
components/<domain>/<ComponentName>.tsx     — Domain component
components/ui/<ComponentName>.tsx           — Generic/shadcn component
lib/api/<service>.ts                        — API fetch layer (NO business logic)
lib/hooks/use<Domain>.ts                    — React Query hooks (fetching + mutations)
lib/store/<domain>.ts                       — Zustand (UI state, NOT server state)
types/index.ts                              — ALL shared types here, no inline interfaces
```

**Do NOT:**
- Put fetch calls in components (always via `lib/api/`)
- Duplicate types across files
- Use `any` — use `unknown` and narrow
- Import Zustand store directly from components outside its domain
- Use `console.log` in production code (only `console.warn/error` for errors)

### 6.2 API Client Pattern

```typescript
// lib/api/client.ts — single bnFetch wrapper
// Every service file:
const SVC = process.env.NEXT_PUBLIC_<SERVICE>_URL ?? 'http://localhost:<port>';

export async function doSomething(params): Promise<Result> {
  return bnFetch<Result>(SVC, `/v1/resource`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
```

### 6.3 State Management Decision Tree

```
Is this server data? → React Query (useQuery/useMutation)
Is this UI-only state local to one component? → useState
Is this UI state shared across routes? → Zustand store slice
```

---

## 7. DevOps & Deployment Standards

### 7.1 Deploy Process (server: 204.168.137.104)

```bash
# Full deploy (pull + build + restart)
bash /opt/blinkone/scripts/restart_frontend_standalone.sh

# Rebuild only (env changes, no code change)
SKIP_PULL=1 bash /opt/blinkone/scripts/restart_frontend_standalone.sh
```

### 7.2 Environment Variables (Non-negotiable)

```
# Frontend (.env.production)
NEXT_PUBLIC_GATEWAY_URL=wss://ws.blinksone.com
NEXT_PUBLIC_SIP_WSS=wss://sip.blinksone.com:7443
NEXT_PUBLIC_SIP_DOMAIN=blinksone.com
NEXT_PUBLIC_CHATWOOT_URL=https://chatwoot.blinksone.com

# Services (docker-compose .env)
BLINKONE_DATABASE_URL=postgresql://...
REDIS_URL=redis://redis:6379
TOKEN=<shared internal bearer token>
```

### 7.3 Health Check Standard

Every service exposes:
- `GET /health` → `{ status: 'ok', service: 'name' }`
- `GET /readyz` → `{ status: 'ready', db: bool }` (503 if not ready)

---

## 8. Gap Analysis — Priority Matrix

| ID | Feature | Priority | Effort | Current State | Sprint |
|----|---------|----------|--------|---------------|--------|
| G01 | Weighted SBR (proficiency 1–5) | P1 | 3d | Binary matching | S1 |
| G02 | PCI Recording Pause backend | P1 | 3d | UI stub only | S1 |
| G03 | MOS voice quality scoring | P1 | 2d | Not started | S1 |
| G04 | Skills Manager admin UI | P1 | 2d | Not started | S1 |
| G05 | Predictive Dialer (new service) | P1 | 8d | Does not exist | S2 |
| G06 | CDR migrate to PostgreSQL | P1 | 2d | File JSON | S1 |
| G07 | PII log masking | P1 | 1d | Unmasked | S1 |
| G08 | Zod input validation (all services) | P1 | 3d | Manual/inconsistent | S1 |
| G09 | Speech analytics pipeline | P2 | 5d | Not started | S3 |
| G10 | Email threading | P2 | 4d | Not started | S3 |
| G11 | Rate limiting (gateway) | P2 | 1d | Not started | S2 |
| G12 | Custom Dashboard Builder | P2 | 6d | Not started | S4 |
| G13 | Chatwoot private labeling | P2 | 3d | Default branding | S3 |
| G14 | WhatsApp flow IVR node | P2 | 2d | Not started | S3 |
| G15 | Agent gamification | P3 | 4d | Not started | S5 |
| G16 | SOC 2 audit logging | P2 | 3d | Not started | S4 |
| G17 | GDPR export/erasure | P2 | 3d | Not started | S4 |
| G18 | Routing queue metadata → PG | P1 | 2d | File JSON | S1 |
| G19 | API key management | P2 | 3d | Not started | S3 |
| G20 | Webhook delivery + retry | P2 | 2d | Not started | S3 |

---

## 9. Code Review Gates

After every Cursor implementation, validate:

### 9.1 Automated (run before commit)
```bash
# TypeScript — zero errors
cd frontend && npx tsc --noEmit

# Lint
cd frontend && npm run lint

# Backend tests (if test suite exists)
cd services/<name> && npm test
```

### 9.2 Manual Review Checklist
- [ ] No `console.log` in production paths (only `warn`/`error`)
- [ ] No `any` TypeScript (use `unknown` + narrowing)
- [ ] Every endpoint has `tenant_id` isolation
- [ ] Every new route has input validation (Zod)
- [ ] PII fields masked in logs
- [ ] Error states handled in UI (loading, error, empty states all present)
- [ ] New components follow `components/<domain>/` pattern
- [ ] New API calls go through `lib/api/<service>.ts` (not inline fetch)
- [ ] React Query used for server data (not Zustand)
- [ ] New env vars documented in `.env.example`

---

## 10. C3D Scoring Roadmap

Current: **75.7%** → Target: **88%+**

| C3D Dimension | Current | Target | Key Gap |
|--------------|---------|--------|---------|
| Routing Accuracy | 62% | 85% | Weighted SBR |
| First Call Resolution | 58% | 75% | Agent Assist, ACW notes |
| Voice Quality | 71% | 90% | MOS scoring, WebRTC ICE optimization |
| Digital Engagement | 68% | 88% | WhatsApp IVR, omni-channel |
| Agent Productivity | 74% | 90% | Predictive Dialer, Gamification |
| Compliance | 55% | 85% | PCI Pause, GDPR, Audit Log |
