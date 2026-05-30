# PROMPT 29 — Real-Time WebSocket Wallboard + Live Agent Presence
## BlinkOne · blinksone.com · TRD Requirements TR-19, TR-13, TR-40

---

## CONTEXT

The routing service at `services/routing` already has:
- A WebSocket server in `services/routing/lib/realtime-ws.js` that pushes data every 2s
- Endpoint: `ws://routing:8798/v1/realtime?tenant_id=<id>`
- `getRealtimeDashboard()` in `lib/dashboards.js` returns agent states and queue stats

**The problem**: The frontend wallboard (`WallboardView.tsx`) uses HTTP polling every 5 seconds via React Query. Two hardcoded demo values exist: `missedToday: 3` and `handled today: 42`. The WebSocket is already built on the backend — the frontend just needs to connect to it.

The routing service WebSocket is not exposed through Nginx yet either.

---

## PART A — Expose Routing WebSocket via Nginx

Open `/etc/nginx/sites-available/blinkone` on the server (and update the local copy in `nginx/` if it exists in the repo).

Add a WebSocket proxy block for the routing realtime endpoint, BEFORE the `location /` block:

```nginx
# Routing real-time WebSocket
location /ws/routing {
    proxy_pass http://127.0.0.1:8798;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

> Note: The routing service listens on port 8798 inside Docker. Ensure Nginx can reach it. If routing is in Docker, expose port 8798 in docker-compose.yml:
> ```yaml
> ports:
>   - "127.0.0.1:8798:8798"
> ```
> Then test Nginx: `nginx -t && systemctl reload nginx`

---

## PART B — Frontend: Real-Time WebSocket Hook

Create `frontend/src/lib/hooks/useRealtimeWallboard.ts`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth';

export interface AgentStateEntry {
  agentId: string;
  name: string;
  email: string;
  state: 'available' | 'busy' | 'away' | 'offline';
  currentCallId?: string;
  queueId?: string;
  updatedAt: string;
}

export interface QueueStatEntry {
  id: string;
  name: string;
  waiting: number;
  active: number;
  longestWait: number; // seconds
}

export interface RealtimeDashboard {
  agents: AgentStateEntry[];
  queues: QueueStatEntry[];
  handledToday: number;
  missedToday: number;
  totalToday: number;
  updatedAt: string;
}

const INITIAL: RealtimeDashboard = {
  agents: [],
  queues: [],
  handledToday: 0,
  missedToday: 0,
  totalToday: 0,
  updatedAt: new Date().toISOString(),
};

export function useRealtimeWallboard() {
  const [data, setData] = useState<RealtimeDashboard>(INITIAL);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tenantId = useAuthStore(s => s.user?.account_id ?? 'default');

  useEffect(() => {
    let destroyed = false;

    function connect() {
      if (destroyed) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws/routing/v1/realtime?tenant_id=${tenantId}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!destroyed) setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'realtime' && msg.data) {
            setData(msg.data as RealtimeDashboard);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (destroyed) return;
        setConnected(false);
        // Reconnect after 3 seconds
        retryRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [tenantId]);

  return { data, connected };
}
```

---

## PART C — Update WallboardView to Use WebSocket

Open `frontend/src/components/routing/WallboardView.tsx` and replace the entire file:

```tsx
'use client';

import { useState } from 'react';
import { useRealtimeWallboard } from '@/lib/hooks/useRealtimeWallboard';
import { QueueStats } from '@/components/routing/QueueStats';
import { WallboardTable } from '@/components/routing/WallboardTable';
import { cn } from '@/lib/utils/cn';

export function WallboardView() {
  const { data, connected } = useRealtimeWallboard();
  const [queueFilter, setQueueFilter] = useState<string>('all');

  const agents = data.agents;
  const queues = data.queues;
  const waiting = queues.reduce((n, q) => n + (q.waiting ?? 0), 0);
  const online = agents.filter(a => a.state !== 'offline').length;
  const activeCalls = agents.filter(a => a.currentCallId).length;
  const missRate = data.totalToday > 0
    ? Math.round((data.missedToday / data.totalToday) * 100)
    : 0;

  return (
    <div className="p-4 space-y-4 bg-surface-tertiary min-h-full">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Realtime wallboard</h1>
        <span
          className={cn(
            'size-2 rounded-full',
            connected ? 'bg-green-500 animate-pulse' : 'bg-amber-400'
          )}
        />
        <span className="text-xs text-muted-foreground">
          {connected ? 'Live' : 'Reconnecting…'}
        </span>
        <select
          value={queueFilter}
          onChange={e => setQueueFilter(e.target.value)}
          className="ms-auto text-xs border border-gray-200 rounded-md px-2 py-1 bg-white"
        >
          <option value="all">All queues</option>
          {queues.map(q => (
            <option key={q.id} value={q.id}>
              {q.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Active calls', value: activeCalls, tone: 'text-blue-600' },
          {
            label: 'Waiting',
            value: waiting,
            tone: waiting > 5 ? 'text-amber-600' : 'text-gray-900',
          },
          { label: 'Agents online', value: `${online}/${agents.length}`, tone: 'text-green-700' },
          { label: 'Handled today', value: data.handledToday, tone: 'text-gray-900' },
          {
            label: 'Missed today',
            value: data.missedToday,
            tone: missRate > 10 ? 'text-red-600' : 'text-gray-900',
          },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <p className="kpi-label">{k.label}</p>
            <p className={cn('kpi-value', k.tone)}>{k.value}</p>
          </div>
        ))}
      </div>

      <QueueStats queues={queues} filter={queueFilter} />
      <WallboardTable agents={agents} filter={queueFilter} />
    </div>
  );
}
```

---

## PART D — Update QueueStats and WallboardTable to Accept Props

**`QueueStats.tsx`** — update to accept optional `queues` and `filter` props (fallback to hook data if not provided):

```tsx
interface Props {
  queues?: QueueStatEntry[];
  filter?: string;
}

export function QueueStats({ queues: propQueues, filter = 'all' }: Props) {
  // If no props passed, fall back to polling hook for backwards compat
  const { data: hookQueues = [] } = useQueues();
  const queues = propQueues ?? hookQueues;
  const visible = filter === 'all' ? queues : queues.filter(q => q.id === filter);
  // ... render visible
}
```

**`WallboardTable.tsx`** — update to accept optional `agents` and `filter` props similarly.

---

## PART E — Update dashboards.js to Return handledToday / missedToday

Open `services/routing/lib/dashboards.js`. The `getRealtimeDashboard()` function needs to return real daily counters. Add these queries (assumes a `call_events` or `routing_events` table, or query from Postgres):

```javascript
export async function getRealtimeDashboard(tenantId) {
  const pool = dbEnabled() ? getPool() : null;

  // Agent states from Redis or DB
  const agentStates = await listAgentStates(tenantId);
  const queueStats = await getQueueStats(tenantId);

  // Daily counters — query from routing_events or calls table
  let handledToday = 0;
  let missedToday = 0;

  if (pool) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    try {
      const { rows } = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE outcome = 'handled') AS handled,
           COUNT(*) FILTER (WHERE outcome = 'abandoned') AS missed
         FROM routing_events
         WHERE tenant_id = $1 AND created_at::date = $2`,
        [tenantId, today]
      );
      handledToday = parseInt(rows[0]?.handled ?? '0', 10);
      missedToday = parseInt(rows[0]?.missed ?? '0', 10);
    } catch {
      // table may not exist yet — use defaults
    }
  }

  return {
    agents: agentStates,
    queues: queueStats,
    handledToday,
    missedToday,
    totalToday: handledToday + missedToday,
    updatedAt: new Date().toISOString(),
  };
}
```

If `routing_events` table doesn't exist, create it in a new migration `services/routing/db/002_events.sql`:

```sql
CREATE TABLE IF NOT EXISTS routing_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  call_id     text,
  agent_id    text,
  queue_id    text,
  outcome     text NOT NULL CHECK (outcome IN ('handled','abandoned','transferred')),
  wait_sec    int,
  talk_sec    int,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routing_events_tenant_date
  ON routing_events(tenant_id, created_at);
```

Call this migration from `services/routing/lib/db.js` startup.

---

## VERIFICATION CHECKLIST

- [ ] Nginx `/ws/routing` proxy block is present: `grep -A5 "location /ws/routing" /etc/nginx/sites-available/blinkone`
- [ ] Browser DevTools → Network → WS shows connection to `wss://app.blinksone.com/ws/routing/v1/realtime`
- [ ] Wallboard shows "Live" indicator (green pulse) instead of "Reconnecting…"
- [ ] Agent state changes (e.g. setting agent to Away) reflect in the wallboard within 2 seconds
- [ ] `missedToday` and `handledToday` are real numbers, not hardcoded 3 and 42
- [ ] Page still works if WebSocket disconnects (auto-reconnects after 3s)

---

## TRD REQUIREMENTS COVERED

| TRD ID | Requirement | Status After Prompt |
|--------|-------------|---------------------|
| TR-19  | Real-time supervisor wallboard with live data | ✅ DONE |
| TR-13  | Agent presence and state tracking | ✅ DONE |
| TR-40  | Live queue metrics (waiting, active, longest wait) | ✅ DONE |
