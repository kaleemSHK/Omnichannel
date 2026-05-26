# Cursor Prompt — Sprint 1 / Feature G02
# PCI Recording Pause — Backend Implementation

**Reviewer gate:** `npx tsc --noEmit` zero errors. Security-sensitive — double review required.  
**Architecture doc:** `docs/ARCHITECTURE.md §3.2, §5`

---

## Context You Must Read First

1. `services/recording/src/server.js` — current recording REST API
2. `services/recording/lib/store.js` — file store structure
3. `frontend/src/components/calling/CallingWorkspace.tsx` — existing PCI pause UI stub
4. `frontend/src/lib/api/calls.ts` — calls API client
5. `frontend/src/lib/store/calls.ts` — Zustand calls store

---

## Background: Why PCI Recording Pause?

When a customer reads out a card number (PAN, CVV, expiry), the agent must trigger "PCI Pause" to comply with PCI DSS scope requirements. The recording must NOT contain those digits in audio form. The system must:
1. Immediately signal the recording service to "pause" capture
2. Log the pause/resume audit trail with timestamps and agent ID
3. On playback, skip/silence the paused interval

---

## What To Build

### Backend: `services/recording/src/server.js`

#### 1. PCI Pause endpoint

```
POST /v1/recordings/:id/pci/pause
Headers: Authorization: Bearer <TOKEN>
         X-BlinkOne-Agent-Id: <agentId>

Body: { "reason": "card_entry" }  // optional, default "pci_pause"

Response 200: {
  "data": {
    "recordingId": "rec-123",
    "pausedAt": "2026-05-26T10:30:00.000Z",
    "pauId": "pau-1"   // pause event ID
  }
}

Error if recording not found: 404
Error if recording already paused: 409 { "error": { "code": "ALREADY_PAUSED" } }
```

#### 2. PCI Resume endpoint

```
POST /v1/recordings/:id/pci/resume
Headers: Authorization: Bearer <TOKEN>
         X-BlinkOne-Agent-Id: <agentId>

Response 200: {
  "data": {
    "recordingId": "rec-123",
    "resumedAt": "2026-05-26T10:30:45.000Z",
    "durationPausedMs": 45000,
    "pauId": "pau-1"
  }
}

Error if not currently paused: 409 { "error": { "code": "NOT_PAUSED" } }
```

#### 3. PCI Audit log endpoint

```
GET /v1/recordings/:id/pci/audit
Headers: Authorization: Bearer <TOKEN>

Response 200: {
  "data": [
    {
      "pauId": "pau-1",
      "agentId": "agent-42",
      "pausedAt": "2026-05-26T10:30:00.000Z",
      "resumedAt": "2026-05-26T10:30:45.000Z",
      "durationPausedMs": 45000,
      "reason": "card_entry"
    }
  ]
}
```

---

### Backend: Recording Data Model

Update the recording object stored in file store (and PG if DB enabled) to include:

```javascript
{
  id: "rec-123",
  // ... existing fields ...
  
  // NEW FIELDS:
  pciStatus: "recording" | "paused",  // current state
  pciPauses: [
    {
      pauId: "pau-1",
      agentId: "agent-42",
      pausedAt: "ISO8601",
      resumedAt: "ISO8601 or null",
      durationPausedMs: 45000,  // null until resumed
      reason: "card_entry"
    }
  ]
}
```

In the store implementation, `pciStatus` starts as `"recording"` and transitions to/from `"paused"` via the endpoints above.

---

### Backend: Playback Integration

In `GET /v1/recordings/:id/play` (the audio streaming endpoint), add a response header:

```
X-BlinkOne-PCI-Pauses: [{"from":30.5,"to":75.2},{"from":120.0,"to":null}]
```

Where `from`/`to` are **seconds from start of recording** when each pause occurred.

The calculation: `(pause.pausedAt - recording.startedAt) / 1000` seconds.

**Note:** The server does NOT modify the audio file. The client-side player uses these time ranges to skip/mute during playback. This is intentional — modifying the audio binary would require additional processing and could corrupt the evidence file.

---

### Backend: Zod Validation

Add `zod` to `services/recording/package.json` dependencies.

Create `services/recording/lib/validation.js`:
```javascript
import { z } from 'zod';

export const PciPauseBodySchema = z.object({
  reason: z.string().max(100).optional().default('pci_pause'),
});

export function validateBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const err = new Error(result.error.issues[0].message);
    err.code = 'VALIDATION_ERROR';
    err.status = 400;
    throw err;
  }
  return result.data;
}
```

---

### Frontend: API Layer — `frontend/src/lib/api/recording.ts`

Add these functions:

```typescript
export async function pausePciRecording(
  recordingId: string,
  reason?: string
): Promise<{ recordingId: string; pausedAt: string; pauId: string }> {
  return bnFetch(SVC, `/v1/recordings/${recordingId}/pci/pause`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason ?? 'card_entry' }),
  });
}

export async function resumePciRecording(
  recordingId: string
): Promise<{ recordingId: string; resumedAt: string; durationPausedMs: number }> {
  return bnFetch(SVC, `/v1/recordings/${recordingId}/pci/resume`, {
    method: 'POST',
  });
}

export interface PciPauseEvent {
  pauId: string;
  agentId: string;
  pausedAt: string;
  resumedAt: string | null;
  durationPausedMs: number | null;
  reason: string;
}

export async function getPciAudit(recordingId: string): Promise<PciPauseEvent[]> {
  const result = await bnFetch<PciPauseEvent[]>(SVC, `/v1/recordings/${recordingId}/pci/audit`);
  return result;
}
```

---

### Frontend: Zustand Store — `frontend/src/lib/store/calls.ts`

Add to the calls store state:

```typescript
// In CallsState interface:
pciPaused: boolean;
activeRecordingId: string | null;

// In CallsStore:
setPciPaused: (paused: boolean) => void;
setActiveRecordingId: (id: string | null) => void;
```

When a call connects and a recording ID is received via the call session, store it in `activeRecordingId`.

---

### Frontend: CallingWorkspace PCI Pause Button — `frontend/src/components/calling/CallingWorkspace.tsx`

Find the existing PCI pause stub (search for "PCI" or "pci") and replace it with a working implementation:

```tsx
// Hook: connect pciPaused state and handlers
const pciPaused = useCallsStore(s => s.pciPaused);
const setPciPaused = useCallsStore(s => s.setPciPaused);
const activeRecordingId = useCallsStore(s => s.activeRecordingId);

async function handlePciToggle() {
  if (!activeRecordingId) {
    toast.warning('No active recording to pause');
    return;
  }
  try {
    if (!pciPaused) {
      await pausePciRecording(activeRecordingId, 'card_entry');
      setPciPaused(true);
      toast.success('Recording paused — safe to collect card details');
    } else {
      await resumePciRecording(activeRecordingId);
      setPciPaused(false);
      toast.success('Recording resumed');
    }
  } catch (err) {
    toast.error(`PCI pause failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}
```

**Button design:**
```tsx
<button
  type="button"
  onClick={handlePciToggle}
  aria-pressed={pciPaused}
  aria-label={pciPaused ? 'Resume recording' : 'Pause recording (PCI)'}
  className={cn(
    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
    pciPaused
      ? 'bg-red-100 text-red-700 border border-red-300 animate-pulse'
      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  )}
>
  {pciPaused ? (
    <><ShieldOff className="w-3.5 h-3.5" /> Recording Paused</>
  ) : (
    <><Shield className="w-3.5 h-3.5" /> PCI Pause</>
  )}
</button>
```

Import `Shield`, `ShieldOff` from `lucide-react`.

**When to show:** Only when `activeCall?.status === 'connected'` AND `activeRecordingId` is set.

---

### Frontend: RecordingsPanel — PCI Skip on Playback

In `frontend/src/components/calling/RecordingsPanel.tsx`, update the `playRecording` function to:

1. Fetch PCI audit for the recording: `getPciAudit(id)`
2. After `audio.play()` starts, attach a `timeupdate` listener
3. During playback, if current time falls within a paused interval: `audio.currentTime = interval.to` (skip forward)
4. Show PCI badge on recordings that have `pciPauses.length > 0`

```tsx
// In the recording list item, show PCI badge if applicable:
{r.pciPauses?.length > 0 && (
  <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
    PCI
  </span>
)}
```

---

## Security Requirements (Non-Negotiable)

1. **Audit trail is append-only** — never delete `pciPauses` entries
2. **Agent ID in every audit entry** — read from `req.headers['x-blinkone-agent-id']`
3. **Timestamps in UTC ISO 8601** — never local time
4. **Log all PCI pause/resume events** via `log.info({ recordingId, agentId, event: 'pci_pause' }, 'PCI event')` — without logging any card number data
5. **NEVER log the reason field content** — it may accidentally contain card data typed by agent

---

## Files To Create/Modify Summary

```
MODIFY  services/recording/src/server.js    (add /pci/pause, /pci/resume, /pci/audit routes)
CREATE  services/recording/lib/validation.js
MODIFY  services/recording/package.json     (add zod)
MODIFY  frontend/src/lib/api/recording.ts   (add pausePciRecording, resumePciRecording, getPciAudit)
MODIFY  frontend/src/lib/store/calls.ts     (add pciPaused, activeRecordingId state)
MODIFY  frontend/src/components/calling/CallingWorkspace.tsx  (wire PCI button)
MODIFY  frontend/src/components/calling/RecordingsPanel.tsx   (skip playback, PCI badge)
MODIFY  frontend/src/types/index.ts         (add PciPauseEvent type)
```

---

## Validation After Build

1. `cd frontend && npx tsc --noEmit` → zero errors
2. PCI button appears only during active connected call
3. Click PCI Pause → button turns red with pulse + toast "Recording paused"
4. Click again → button returns to normal + toast "Recording resumed"
5. `GET /v1/recordings/:id/pci/audit` returns the correct pause events
6. Double-pause returns 409 ALREADY_PAUSED
