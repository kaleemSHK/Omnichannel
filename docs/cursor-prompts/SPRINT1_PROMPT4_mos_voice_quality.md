# Cursor Prompt — Sprint 1 / Feature G03
# MOS Voice Quality Scoring

**Reviewer gate:** `npx tsc --noEmit` zero errors. No external paid APIs — use only open formulas.  
**Architecture doc:** `docs/ARCHITECTURE.md §3.1, §8`

---

## Context You Must Read First

1. `services/calls/src/server.js` — call session lifecycle
2. `services/calls/lib/cdr-repo.js` — CDR storage
3. `frontend/src/components/routing/WallboardTable.tsx` — existing quality columns
4. `frontend/src/components/routing/QueueStats.tsx` — stats display pattern
5. `frontend/src/lib/api/calls.ts` — calls API client

---

## What To Build

**Mean Opinion Score (MOS)** estimation for every completed call, displayed on the wallboard and in CDR reports. MOS is a standard 1–5 voice quality scale (5 = excellent, 1 = bad).

We use the **E-model (ITU-T G.107) simplified formula** which derives MOS from:
- Packet loss (%)
- Jitter (ms)
- Round-trip latency (ms)

This data comes from the WebRTC `RTCInboundRtpStreamStats` polled by JsSIP's peer connection during the call.

---

## Architecture

```
Browser (JsSIP)
   ↓ RTCInboundRtpStreamStats every 5s
   ↓ POST /v1/calls/:sessionId/quality-sample
calls service
   ↓ accumulates samples during call
   ↓ on call end → calcMOS() → store mos_score in CDR
Frontend Wallboard
   ↓ shows latest mos_score per agent
Reports page
   ↓ shows MOS trend over time
```

---

## Step 1: MOS Formula — `services/calls/lib/mos.js` (NEW FILE)

```javascript
/**
 * ITU-T E-model simplified MOS estimation.
 * 
 * @param {object} stats
 * @param {number} stats.packetLoss    — percentage (0–100)
 * @param {number} stats.jitterMs      — jitter in milliseconds
 * @param {number} stats.rttMs         — round-trip time in milliseconds
 * @returns {number} MOS score 1.0–4.5 (clamped, 2 decimal places)
 */
export function calculateMOS({ packetLoss, jitterMs, rttMs }) {
  // Effective latency = one-way delay estimate
  const oneWayDelayMs = (rttMs / 2) + jitterMs * 2;

  // R-factor base (starting from 93.2 for G.711)
  let R = 93.2;

  // Delay degradation (Id)
  if (oneWayDelayMs > 150) {
    R -= (oneWayDelayMs - 150) * 0.1;
  }

  // Packet loss degradation (Ie-eff)
  // For G.711: Ie=0, Bpl=25.1
  const Ie = 0;
  const Bpl = 25.1;
  const ppl = Math.min(packetLoss, 100);
  const Ie_eff = Ie + (95 - Ie) * (ppl / (ppl + Bpl));
  R -= Ie_eff;

  // Clamp R to valid range
  R = Math.max(0, Math.min(100, R));

  // R to MOS conversion (ITU-T G.107 Table 3)
  let mos;
  if (R <= 0) {
    mos = 1.0;
  } else if (R >= 100) {
    mos = 4.5;
  } else {
    mos = 1 + 0.035 * R + R * (R - 60) * (100 - R) * 7e-6;
  }

  return Math.round(Math.max(1.0, Math.min(4.5, mos)) * 100) / 100;
}

/**
 * Classify MOS into human label.
 * @param {number} mos
 * @returns {"excellent"|"good"|"fair"|"poor"|"bad"}
 */
export function mosLabel(mos) {
  if (mos >= 4.2) return 'excellent';
  if (mos >= 3.6) return 'good';
  if (mos >= 3.1) return 'fair';
  if (mos >= 2.6) return 'poor';
  return 'bad';
}

/**
 * Aggregate multiple MOS samples (average, ignoring nulls).
 * @param {number[]} samples
 * @returns {number|null}
 */
export function aggregateMOS(samples) {
  const valid = samples.filter(s => s != null && !isNaN(s));
  if (!valid.length) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100;
}
```

---

## Step 2: Quality Samples API — `services/calls/src/server.js`

#### Add quality sample endpoint:

```
POST /v1/calls/:sessionId/quality-sample
Body: {
  packetLoss: 0.5,         // percentage
  jitterMs: 12,
  rttMs: 85,
  timestamp: "ISO8601"    // optional, default now()
}

Response 200: { "data": { "mos": 4.1, "label": "good" } }
```

Implementation:
1. Load or create the quality sample store for this session
2. Calculate instantaneous MOS from the sample
3. Append sample to `call.qualitySamples` array
4. Update `call.latestMos` in the store

#### Add quality summary to CDR on call end:

When a call session ends (`PATCH /v1/calls/:sessionId` with `status: 'ended'`):
1. Pull all quality samples from `call.qualitySamples`
2. Calculate aggregate MOS via `aggregateMOS()`
3. Store `mos_score`, `avg_packet_loss`, `avg_jitter_ms`, `avg_rtt_ms` in CDR

#### Add quality query endpoint:

```
GET /v1/calls/:sessionId/quality
Response 200: {
  "data": {
    "mosScore": 3.8,
    "mosLabel": "good",
    "avgPacketLoss": 0.5,
    "avgJitterMs": 12,
    "avgRttMs": 85,
    "sampleCount": 24
  }
}
```

---

## Step 3: CDR Model Update — `services/calls/lib/cdr-repo.js`

Add to the CDR record shape:
```javascript
{
  // ... existing fields ...
  mosScore: null,           // number 1.0–4.5 or null
  mosLabel: null,           // 'excellent'|'good'|'fair'|'poor'|'bad' or null
  avgPacketLoss: null,      // percentage
  avgJitterMs: null,        // milliseconds
  avgRttMs: null,           // milliseconds
  qualitySampleCount: 0,
}
```

---

## Step 4: Browser-Side Stats Collection — `frontend/src/lib/hooks/useJsSip.ts`

In the `session.on('confirmed', ...)` handler, after the call connects, start a polling interval:

```typescript
// After call confirmed, start WebRTC stats polling
let statsInterval: ReturnType<typeof setInterval> | null = null;

session.on('confirmed', () => {
  // ... existing confirmed logic ...
  
  statsInterval = setInterval(async () => {
    const pc = (session as unknown as { connection?: RTCPeerConnection }).connection;
    if (!pc) return;
    
    try {
      const stats = await pc.getStats();
      let packetLoss = 0;
      let jitter = 0;
      let rtt = 0;
      let hasData = false;

      stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          const received = report.packetsReceived ?? 0;
          const lost = report.packetsLost ?? 0;
          const total = received + lost;
          packetLoss = total > 0 ? (lost / total) * 100 : 0;
          jitter = (report.jitter ?? 0) * 1000; // convert to ms
          hasData = true;
        }
        if (report.type === 'remote-inbound-rtp' && report.kind === 'audio') {
          rtt = (report.roundTripTime ?? 0) * 1000; // convert to ms
        }
      });

      if (hasData) {
        const sessionId = useCallsStore.getState().activeCall?.id;
        if (sessionId) {
          void postQualitySample(sessionId, { packetLoss, jitterMs: jitter, rttMs: rtt });
        }
      }
    } catch {
      // WebRTC stats not available — ignore
    }
  }, 5000); // every 5 seconds
});

session.on('ended', () => {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  // ... existing ended logic ...
});

session.on('failed', () => {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  // ... existing failed logic ...
});
```

---

## Step 5: Frontend API — `frontend/src/lib/api/calls.ts`

Add:

```typescript
export interface QualitySample {
  packetLoss: number;
  jitterMs: number;
  rttMs: number;
  timestamp?: string;
}

export interface QualitySummary {
  mosScore: number | null;
  mosLabel: 'excellent' | 'good' | 'fair' | 'poor' | 'bad' | null;
  avgPacketLoss: number | null;
  avgJitterMs: number | null;
  avgRttMs: number | null;
  sampleCount: number;
}

export async function postQualitySample(
  sessionId: string,
  sample: QualitySample
): Promise<{ mos: number; label: string }> {
  return bnFetch(SVC, `/v1/calls/${sessionId}/quality-sample`, {
    method: 'POST',
    body: JSON.stringify(sample),
  });
}

export async function getCallQuality(sessionId: string): Promise<QualitySummary> {
  return bnFetch<QualitySummary>(SVC, `/v1/calls/${sessionId}/quality`);
}
```

---

## Step 6: MOS Display — Wallboard

In `frontend/src/components/routing/WallboardTable.tsx`, add a **MOS** column:

```tsx
// In the agent row, after the status/duration columns:
<td className="text-center">
  {agent.mosScore != null ? (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded',
      agent.mosScore >= 4.2 ? 'bg-green-100 text-green-700' :
      agent.mosScore >= 3.6 ? 'bg-blue-100 text-blue-700' :
      agent.mosScore >= 3.1 ? 'bg-yellow-100 text-yellow-700' :
      agent.mosScore >= 2.6 ? 'bg-orange-100 text-orange-700' :
      'bg-red-100 text-red-700'
    )}>
      {agent.mosScore.toFixed(1)}
    </span>
  ) : (
    <span className="text-muted-foreground text-xs">—</span>
  )}
</td>
```

Also show a **tenant average MOS** in `QueueStats.tsx`:

```tsx
{stats.avgMos != null && (
  <div className="flex items-center justify-between">
    <span className="text-xs text-muted-foreground">Avg Voice Quality</span>
    <span className={cn('text-sm font-semibold', mosColor(stats.avgMos))}>
      MOS {stats.avgMos.toFixed(1)}
    </span>
  </div>
)}
```

---

## Step 7: Types — `frontend/src/types/index.ts`

Add:
```typescript
export type MosLabel = 'excellent' | 'good' | 'fair' | 'poor' | 'bad';

// Extend CDRRecord (or CallSession) with optional MOS:
// mosScore?: number | null;
// mosLabel?: MosLabel | null;
```

---

## Files To Create/Modify Summary

```
CREATE  services/calls/lib/mos.js
MODIFY  services/calls/src/server.js   (add /quality-sample, /quality endpoints)
MODIFY  services/calls/lib/cdr-repo.js (add MOS fields to CDR record)
MODIFY  frontend/src/lib/api/calls.ts  (add postQualitySample, getCallQuality)
MODIFY  frontend/src/lib/hooks/useJsSip.ts  (add stats polling interval)
MODIFY  frontend/src/components/routing/WallboardTable.tsx  (MOS column)
MODIFY  frontend/src/components/routing/QueueStats.tsx  (avg MOS stat)
MODIFY  frontend/src/types/index.ts    (MosLabel, extend CallSession/CDR)
```

---

## Validation After Build

1. `cd frontend && npx tsc --noEmit` → zero errors
2. Place a test call (or use demo mode) — quality samples POST every 5s (visible in browser Network tab)
3. After call ends, CDR record contains `mosScore` and `mosLabel`
4. Wallboard shows MOS badge with correct color (green ≥4.2, blue ≥3.6, yellow ≥3.1, orange ≥2.6, red <2.6)
5. `calculateMOS({ packetLoss: 0, jitterMs: 0, rttMs: 20 })` returns approximately 4.4
6. `calculateMOS({ packetLoss: 5, jitterMs: 50, rttMs: 200 })` returns approximately 2.8–3.2
