# Cursor Prompt — Sprint 2 / Feature G05
# Predictive Dialer — New Microservice

**Status:** After Sprint 1 is complete and reviewed.  
**Effort:** ~8 days. Build incrementally — dialer runs in preview/manual mode first, auto-pacing second.  
**Architecture doc:** `docs/ARCHITECTURE.md §3.3`

---

## Context You Must Read First

1. `services/calls/src/server.js` — call session creation (dialer will call this)
2. `services/routing/lib/selection.js` — SBR (dialer should respect agent availability)
3. `docker-compose.yml` — add dialer service here
4. `.env.example` — add dialer env vars here

---

## What To Build

A `services/dialer/` microservice that manages **outbound calling campaigns**. 

### Core Concepts:
- **Campaign**: a named outbound effort with a contact list, script, and pacing config
- **Contact list**: CSV/manual import of phone numbers to dial
- **Pacing**: ratio of dials to available agents (starts at 1:1 preview mode)
- **AMD**: Answering Machine Detection — drops machine-answered calls
- **DNC list**: Do Not Call list — never dials blacklisted numbers
- **Abandon rate**: % of calls connected to customer but no agent available — must stay ≤ 3% (FCC)

---

## Directory Structure

```
services/dialer/
├── package.json
├── Dockerfile
├── src/
│   └── server.js              — Express REST API
├── lib/
│   ├── campaign-repo.js       — Campaign + contact list CRUD
│   ├── contact-list-repo.js   — Contact management, import, status tracking
│   ├── pacing-engine.js       — Erlang C pacing algorithm
│   ├── amd.js                 — AMD detection logic (SIP 183 + tone analysis)
│   ├── dnc-list.js            — Do Not Call checker
│   ├── call-launcher.js       — Calls `calls` service to initiate outbound
│   ├── campaign-worker.js     — Setinterval worker: dial loop
│   ├── db.js                  — DB connection (same pattern as other services)
│   ├── store.js               — File store fallback
│   ├── logger.js              — Pino logger with PII masking
│   ├── errors.js              — Error classes
│   └── http.js                — Shared HTTP utilities
└── migrations/
    └── 001_create_campaigns.sql
```

---

## REST API

```
POST   /v1/campaigns                         — create campaign
GET    /v1/campaigns                         — list campaigns
GET    /v1/campaigns/:id                     — get campaign detail
PATCH  /v1/campaigns/:id                     — update (name, script, pacing)
DELETE /v1/campaigns/:id                     — archive

POST   /v1/campaigns/:id/start               — begin dialing
POST   /v1/campaigns/:id/pause               — pause (complete active calls)
POST   /v1/campaigns/:id/stop                — stop and reset

POST   /v1/campaigns/:id/contacts            — upload contact list (JSON array)
GET    /v1/campaigns/:id/contacts            — list contacts with status
DELETE /v1/campaigns/:id/contacts/:contactId — remove contact

GET    /v1/campaigns/:id/stats               — live stats: dialed, connected, abandoned, rate
GET    /v1/campaigns/:id/cdrs                — completed calls for campaign

POST   /v1/dnc                               — add number to DNC list
DELETE /v1/dnc/:phone                        — remove from DNC
GET    /v1/dnc                               — list DNC numbers

GET    /health                               — health check
GET    /readyz                               — readiness check
```

---

## Data Models

### Campaign
```javascript
{
  id: 'uuid',
  tenantId: 'string',
  name: 'string',
  status: 'draft' | 'running' | 'paused' | 'completed' | 'archived',
  
  // Pacing configuration
  pacingMode: 'preview' | 'progressive' | 'predictive',
  dialRatio: 1.0,           // dials per available agent (1.0 = one call per agent)
  maxAbandonRate: 3.0,      // FCC 3% cap
  retryAttempts: 3,
  retryIntervalMinutes: 60,
  
  // Schedule
  timezone: 'America/New_York',
  dialHoursStart: '09:00',  // TCPA compliance
  dialHoursEnd: '21:00',
  daysOfWeek: [1,2,3,4,5], // 0=Sun, 6=Sat
  
  // Script / metadata
  scriptText: 'string',
  callerId: '+1XXXXXXXXXX',
  
  // Routing
  queueKey: 'outbound-sales',  // route connected calls to this queue
  
  // Stats (updated by worker)
  totalContacts: 0,
  dialedCount: 0,
  connectedCount: 0,
  abandonedCount: 0,
  completedCount: 0,
  
  createdAt: 'ISO8601',
  updatedAt: 'ISO8601',
}
```

### Contact
```javascript
{
  id: 'uuid',
  campaignId: 'string',
  tenantId: 'string',
  phone: 'string',           // E.164 format
  name: 'string | null',
  email: 'string | null',
  customFields: {},          // arbitrary KV for script personalization
  
  dialStatus: 'pending' | 'dialing' | 'connected' | 'no_answer' | 'busy' | 'amd_dropped' | 'dnc' | 'failed' | 'completed',
  attemptCount: 0,
  lastAttemptAt: null,
  nextAttemptAt: null,
  callSessionId: null,       // link to calls service
  
  createdAt: 'ISO8601',
}
```

---

## Pacing Engine — `lib/pacing-engine.js`

```javascript
/**
 * Calculate how many calls to launch right now.
 * 
 * @param {object} params
 * @param {number} params.availableAgents — agents in 'available' state
 * @param {number} params.dialRatio       — target dials per agent (from campaign config)
 * @param {number} params.inProgressCalls — calls currently dialing/ringing
 * @param {number} params.abanRate        — rolling 60s abandon rate (percentage)
 * @param {number} params.maxAbanRate     — configured max abandon rate
 * @returns {number} number of new calls to launch (can be 0)
 */
export function calcDialsToLaunch({ availableAgents, dialRatio, inProgressCalls, abanRate, maxAbanRate }) {
  // Safety: if abandon rate too high, dial at 1:1 only
  const effectiveRatio = abanRate > maxAbanRate * 0.8 ? 1.0 : dialRatio;

  // Target calls in flight = agents × ratio
  const target = Math.floor(availableAgents * effectiveRatio);
  const toLaunch = Math.max(0, target - inProgressCalls);

  // Never launch more than 10 at once (safety throttle)
  return Math.min(toLaunch, 10);
}
```

---

## FCC/TCPA Compliance

The `campaign-worker.js` MUST check before every dial:
1. Current time is within `dialHoursStart`–`dialHoursEnd` in the campaign timezone
2. Current day-of-week is in `daysOfWeek`
3. Phone is not on DNC list
4. Contact hasn't exceeded `retryAttempts`

If any check fails → skip the contact, set appropriate status.

---

## Frontend: Campaign Manager UI

Create `frontend/src/app/(dashboard)/dialer/page.tsx` and components under `frontend/src/components/dialer/`:

```
CampaignList.tsx     — table of campaigns with status badges
CampaignWizard.tsx   — create/edit campaign (multi-step form)
ContactImport.tsx    — CSV upload or paste phone list
CampaignLiveStats.tsx— live dial stats (dials/min, abandon rate, connected agents)
DncManager.tsx       — DNC list management
```

### Campaign Status Badges:
- `draft` → gray
- `running` → green (pulsing dot)
- `paused` → yellow
- `completed` → blue
- `archived` → gray muted

---

## docker-compose.yml Addition

```yaml
dialer:
  build:
    context: ./services/dialer
    dockerfile: Dockerfile
  ports:
    - "8800:8800"
  environment:
    PORT: 8800
    TOKEN: ${INTERNAL_TOKEN}
    BLINKONE_DATABASE_URL: ${BLINKONE_DATABASE_URL}
    CALLS_URL: http://calls:8792
    ROUTING_URL: http://routing:8798
    LOG_LEVEL: info
  depends_on:
    - calls
    - routing
    - postgres
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:8800/health"]
    interval: 30s
    timeout: 5s
    retries: 3
```

---

## Files To Create Summary

```
CREATE  services/dialer/package.json
CREATE  services/dialer/Dockerfile
CREATE  services/dialer/src/server.js
CREATE  services/dialer/lib/campaign-repo.js
CREATE  services/dialer/lib/contact-list-repo.js
CREATE  services/dialer/lib/pacing-engine.js
CREATE  services/dialer/lib/amd.js
CREATE  services/dialer/lib/dnc-list.js
CREATE  services/dialer/lib/call-launcher.js
CREATE  services/dialer/lib/campaign-worker.js
CREATE  services/dialer/lib/db.js
CREATE  services/dialer/lib/store.js
CREATE  services/dialer/lib/logger.js
CREATE  services/dialer/lib/errors.js
CREATE  services/dialer/lib/http.js
CREATE  services/dialer/migrations/001_create_campaigns.sql
CREATE  frontend/src/app/(dashboard)/dialer/page.tsx
CREATE  frontend/src/components/dialer/CampaignList.tsx
CREATE  frontend/src/components/dialer/CampaignWizard.tsx
CREATE  frontend/src/components/dialer/ContactImport.tsx
CREATE  frontend/src/components/dialer/CampaignLiveStats.tsx
CREATE  frontend/src/components/dialer/DncManager.tsx
CREATE  frontend/src/lib/api/dialer.ts
CREATE  frontend/src/lib/hooks/useDialer.ts
MODIFY  docker-compose.yml   (add dialer service)
MODIFY  .env.example         (add DIALER_URL)
MODIFY  frontend/src/app/(dashboard)/layout.tsx  (add Dialer nav item)
```
