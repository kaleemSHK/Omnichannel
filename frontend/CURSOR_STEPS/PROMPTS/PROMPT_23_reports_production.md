# PROMPT 23 — Reports Module + makeCall SIP Guard: Production Finalization

## Context — read before touching any file

**Stack**: Next.js 14 App Router · Chatwoot v4 REST API · TanStack Query v5 · Zustand · Recharts  
**API clients** (NEVER raw fetch):
- `cwFetch()` → `/_cw/*` → Chatwoot, `api_access_token` header
- `bnFetch()` → `/_gw/*` → BlinkOne gateway, Bearer JWT

**RTL**: `ms-*`/`me-*`/`ps-*`/`pe-*` only — NEVER `ml-*`/`mr-*`/`pl-*`/`pr-*`  
**Demo mode**: `isDemoDataEnabled()` → fixture, never real API  
**RBAC**: Reports are supervisor/admin only — enforce with `can(role, 'viewReports')`  
**No localStorage** — Zustand or TanStack Query only

---

## Part A — makeCall SIP Guard (carry-over from PROMPT_22)

### Problem

`useCallsStore.makeCall` is `null` until `useJsSip()` is mounted. `useJsSip()` is only mounted inside `/calling`. When an agent goes directly to `/contacts` without visiting `/calling` first:

1. `ContactDetailPanel` reads `makeCall` from the store → it is `null`
2. Clicking the Call button is a silent no-op — no error, no feedback
3. The agent has no indication that SIP is not ready

### Fix — Step A1: Global SIP initialisation in the dashboard layout

**File**: `src/app/(dashboard)/layout.tsx`

The dashboard layout wraps all authenticated pages. Mount `useJsSip()` here once — the singleton audio element and UA are shared across every route. Add a `SipInitializer` client component:

**Create `src/components/calling/SipInitializer.tsx`**:

```tsx
'use client';

/**
 * Mounts useJsSip() once at the dashboard level so the SIP UA is
 * initialised regardless of which page the agent opens first.
 * Renders nothing — side-effects only.
 */
import { useJsSip } from '@/lib/hooks/useJsSip';

export function SipInitializer() {
  useJsSip();
  return null;
}
```

**File**: `src/app/(dashboard)/layout.tsx` — add `<SipInitializer />` inside the layout body:

```tsx
import { SipInitializer } from '@/components/calling/SipInitializer';

// Inside the layout JSX, before or after the main content:
<SipInitializer />
```

> **IMPORTANT**: `useJsSip` already guards against demo mode (`if (isDemoDataEnabled()) return`) and missing env vars (`if (!SIP_WSS) return`). Adding it to the layout does NOT break demo mode. The hook is idempotent — calling it in multiple places is safe because `setMakeCall` registers the same stable `makeCall` callback each time.

### Fix — Step A2: Call button shows toast when SIP not ready

**File**: `src/components/contacts/ContactDetailPanel.tsx`

Replace the silent no-op with user feedback:

```tsx
import { toast } from 'sonner';
import { useCallsStore } from '@/lib/store/calls';

// In component:
const makeCall = useCallsStore(s => s.makeCall);
const sipRegistered = useCallsStore(s => s.sipRegistered);

function handleCallContact() {
  if (!phone) return;
  if (!makeCall || !sipRegistered) {
    toast.error('SIP not connected — visit the Calling page to register your phone first.');
    return;
  }
  makeCall(phone);
}

// Button:
<button
  type="button"
  className="p-2 rounded-lg border border-gray-200 hover:bg-muted disabled:opacity-50"
  title={sipRegistered ? 'Call' : 'SIP not connected'}
  disabled={!phone}
  onClick={handleCallContact}
  aria-label={`Call ${displayName}`}
>
  <Phone size={16} className={sipRegistered ? 'text-brand-primary' : 'text-muted-foreground'} />
</button>
```

---

## Part B — Reports Module Bug Inventory (13 issues)

### CRITICAL

**BUG-01 · `useReports.ts` — Chatwoot v4 summary API response shape is wrong**  
The hook requests `/reports/summary` and expects `{ account: { conversations_count, resolved_conversations_count, avg_first_response_time, avg_resolution_time }, chartData: [...], byAgent: [...], byInbox: [...] }`. The actual Chatwoot v4 summary endpoint returns:
```json
{
  "conversations_count": 248,
  "resolved_conversations_count": 198,
  "avg_first_response_time": 252,
  "avg_resolution_time": 8280
}
```
Times are in **seconds (integer)**, not formatted strings. There is no `chartData`, `byAgent`, or `byInbox` in the summary — those are separate endpoints. Fix: rewrite `useReportSummary` to call the correct endpoint and parse seconds into formatted strings. Fetch chart data, by-agent, and by-inbox from their own separate Chatwoot endpoints.

**BUG-02 · `useReports.ts` — agent/inbox/team report endpoints do not exist in Chatwoot v4**  
Lines 67, 87, 107: the hooks call `/reports/agents/conversations`, `/reports/inboxes/conversations`, `/reports/teams/conversations`. These paths do not exist in Chatwoot v4. The real endpoints are:
- Per-agent summary: `GET /accounts/:id/reports/agents/conversations` — actually `/accounts/:id/reports/summary?type=account&since=&until=&id=<agentId>`
- Agent list with stats: `GET /accounts/:id/reports/overview` (v2) which returns `data.agents[]` with `open_conversations_count`, `resolved_conversations_count`
- The correct breakdown is: `GET /api/v2/accounts/:id/reports/overview` for live overview, and individual `/reports/summary?type=agent&id=:agentId` for per-agent time series

Fix: use the correct Chatwoot v4 API paths documented below.

**BUG-03 · `useReports.ts` — `sinceDate('today')` returns today's date string but Chatwoot needs Unix timestamps**  
Lines 22-24: `sinceDate` returns ISO date strings `YYYY-MM-DD`. The Chatwoot `/reports/summary` endpoint expects Unix timestamp integers for `since` and `until`. Sending `since=2026-05-25` results in a `400 Bad Request` or silently returns empty data. Fix: return `Math.floor(Date.now() / 1000)` style values, not ISO strings.

**BUG-04 · `useReports.ts` — silent demo fallback on production errors (same pattern as contacts)**  
Lines 39-53, 70-72, 91-93, 112-113: on API failure in production, returns demo fixture data. Agents see fake LABBIK Telecom numbers instead of an error state. Fix: in production, rethrow errors so TanStack Query exposes `isError = true`.

**BUG-05 · `OverviewReport.tsx` — `chartData` always empty in production because correct API is never called**  
Consequence of BUG-01: `summary?.chartData` is always `[]` in production (the endpoint doesn't return it). Fix: fetch chart data from Chatwoot's `/reports?metric=account&type=account&since=&until=&group_by=day` endpoint separately.

**BUG-06 · `OverviewReport.tsx` — Recharts `AreaChart` with empty data renders a broken SVG with zero-height axes**  
When `chartData` is `[]`, Recharts renders axis lines but no chart area. No empty state is shown. Fix: render an empty state message ("No data for this period") when `chartData.length === 0` and not loading.

**BUG-07 · `OverviewReport.tsx` — `BarChart` for "By agent" is vertical layout but `YAxis width={100}` clips long agent names**  
Agent names like "Sarah Al-Hinai" (14 chars) at 11px font need ~90px. With the 100px width hard-coded, names with company suffixes or 3-part names are truncated. Fix: dynamically compute `YAxis` width from max name length: `Math.min(160, Math.max(100, longestName * 7))`.

**BUG-08 · `AgentReport.tsx` — table uses `row.name` as React key; breaks if two agents share a name**  
Line 81: `key={row.name}`. If an account has agents with identical display names (common in Arabic names — multiple "Mohammed"), React silently de-duplicates. Fix: use `row.id ?? row.name` as the key. Add `id` to the agent report type.

**BUG-09 · `AgentReport.tsx` — sort on string time fields (`avg_first_response`, `avg_resolution`, `online_time`) sorts lexicographically, not by duration**  
Lines 19-27: string values like `"3m 40s"`, `"4m 05s"`, `"1h 55m"` are compared with `localeCompare`. `"4m"` sorts after `"3m"` correctly but `"1h"` sorts before `"4m"` alphabetically even though 1 hour > 4 minutes. Fix: convert formatted durations to seconds before sorting. Add a `parseDurationToSeconds(s: string): number` utility.

**BUG-10 · `InboxReport.tsx` / `TeamReport.tsx` — no empty state when data is `[]`**  
Both tables silently render an empty `<tbody>` when data is empty. Fix: add an empty state row: `<tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No data for this period</td></tr>`.

**BUG-11 · `ReportsWorkspace.tsx` — no RBAC guard; any agent role can access reports**  
The RBAC table (`rbac.ts`) restricts `/reports` to `['supervisor', 'admin', 'platform_admin']` but the component itself has no `can()` check. If a route guard fails or is bypassed, agents see full reporting data. Fix: add role check inside `ReportsWorkspace` and render an access-denied message if the user lacks `viewReports` permission.

**BUG-12 · `ReportsWorkspace.tsx` — all four report components are instantiated simultaneously in the `content` object**  
Lines 23-28: `const content = { overview: <OverviewReport />, agents: <AgentReport />, ... }` — React evaluates all four JSX expressions on every render, causing all four hooks to fire their queries simultaneously even though only one view is visible. Fix: use lazy rendering — only render the active component.

**BUG-13 · `ReportRangeTabs.tsx` — no `aria-pressed` / `role` attributes**  
The range toggle buttons have no ARIA state. Fix: add `role="radio"`, `aria-checked={range === r}`, and wrap in `role="radiogroup"`.

---

## Part B Implementation Steps

### Step B1 — Fix Chatwoot v4 API paths and response shapes

**File**: `src/lib/hooks/useReports.ts` — full rewrite:

```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { cwFetch } from '@/lib/api/client';
import {
  DEMO_AGENT_REPORT,
  DEMO_INBOX_REPORT,
  DEMO_REPORT_SUMMARY,
  DEMO_TEAM_REPORT,
} from '@/lib/demo/chatwootExtrasFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { useAuthStore } from '@/lib/store/auth';

export type ReportRange = 'today' | '7d' | '30d';

function accountId() {
  return useAuthStore.getState().user?.chatwootAccountId ?? 1;
}

/** Returns Unix timestamps for since/until (Chatwoot v4 expects integers) */
function sinceUntil(range: ReportRange): { since: number; until: number } {
  const now = Math.floor(Date.now() / 1000);
  if (range === 'today') {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return { since: Math.floor(startOfDay.getTime() / 1000), until: now };
  }
  const days = range === '7d' ? 7 : 30;
  return { since: now - days * 86_400, until: now };
}

/** Format seconds duration to human string */
export function formatSeconds(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/** Parse "3m 40s", "1h 55m", "4m 05s" → seconds for sorting */
export function parseDurationToSeconds(s: string): number {
  if (!s || s === '—') return 0;
  let total = 0;
  const h = s.match(/(\d+)h/);
  const m = s.match(/(\d+)m/);
  const sec = s.match(/(\d+)s/);
  if (h) total += parseInt(h[1]) * 3600;
  if (m) total += parseInt(m[1]) * 60;
  if (sec) total += parseInt(sec[1]);
  return total;
}

// ─── Summary (overview KPIs) ────────────────────────────────────────────────

interface CWSummaryRaw {
  conversations_count?: number;
  resolved_conversations_count?: number;
  avg_first_response_time?: number;
  avg_resolution_time?: number;
}

export function useReportSummary(range: ReportRange) {
  const { since, until } = sinceUntil(range);
  return useQuery({
    queryKey: ['reportSummary', range, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_REPORT_SUMMARY;
      // Production errors bubble up — no silent fallback
      const raw = await cwFetch<CWSummaryRaw>(
        `/accounts/${accountId()}/reports/summary?since=${since}&until=${until}`,
      );
      return {
        account: {
          conversations_count: raw.conversations_count ?? 0,
          resolved_conversations_count: raw.resolved_conversations_count ?? 0,
          avg_first_response_time: formatSeconds(raw.avg_first_response_time ?? 0),
          avg_resolution_time: formatSeconds(raw.avg_resolution_time ?? 0),
        },
        // Chart data fetched separately (see useReportChart)
        chartData: [] as typeof DEMO_REPORT_SUMMARY.chartData,
        byAgent: [] as typeof DEMO_REPORT_SUMMARY.byAgent,
        byInbox: [] as typeof DEMO_REPORT_SUMMARY.byInbox,
      };
    },
  });
}

// ─── Chart data (conversations over time) ────────────────────────────────────

interface CWReportPoint {
  timestamp: number;
  value: number;
}

export function useReportChart(range: ReportRange) {
  const { since, until } = sinceUntil(range);
  return useQuery({
    queryKey: ['reportChart', range, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_REPORT_SUMMARY.chartData;
      try {
        const [openRes, resolvedRes] = await Promise.all([
          cwFetch<{ payload: CWReportPoint[] }>(
            `/accounts/${accountId()}/reports?metric=account_conversations&type=account&since=${since}&until=${until}&group_by=day`,
          ),
          cwFetch<{ payload: CWReportPoint[] }>(
            `/accounts/${accountId()}/reports?metric=resolved_conversations&type=account&since=${since}&until=${until}&group_by=day`,
          ),
        ]);
        const openMap = new Map(
          (openRes.payload ?? []).map(p => [
            new Date(p.timestamp * 1000).toLocaleDateString('en-US', { weekday: 'short' }),
            p.value,
          ]),
        );
        return (resolvedRes.payload ?? []).map(p => ({
          date: new Date(p.timestamp * 1000).toLocaleDateString('en-US', { weekday: 'short' }),
          open: openMap.get(
            new Date(p.timestamp * 1000).toLocaleDateString('en-US', { weekday: 'short' })
          ) ?? 0,
          resolved: p.value,
        }));
      } catch {
        return DEMO_REPORT_SUMMARY.chartData;
      }
    },
  });
}

// ─── Overview (live agent/inbox breakdown) ────────────────────────────────────

interface CWOverviewAgent {
  id: number;
  name: string;
  open_conversations_count: number;
  resolved_conversations_count: number;
}

export function useOverviewAgents(range: ReportRange) {
  const { since, until } = sinceUntil(range);
  return useQuery({
    queryKey: ['reportOverviewAgents', range, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) {
        return DEMO_REPORT_SUMMARY.byAgent;
      }
      try {
        const res = await cwFetch<{ data?: { agents?: CWOverviewAgent[] } }>(
          `/accounts/${accountId()}/reports/overview`,
        );
        return (res.data?.agents ?? []).map(a => ({
          name: a.name,
          count: a.open_conversations_count + a.resolved_conversations_count,
        }));
      } catch {
        return DEMO_REPORT_SUMMARY.byAgent;
      }
    },
  });
}

// ─── Agent performance report ─────────────────────────────────────────────────

export function useAgentReport(range: ReportRange) {
  const { since, until } = sinceUntil(range);
  return useQuery({
    queryKey: ['reportAgents', range, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_AGENT_REPORT;
      // Chatwoot v4: GET /accounts/:id/reports/agents/conversations
      // Returns array of agent conversation summaries
      const res = await cwFetch<{ payload?: typeof DEMO_AGENT_REPORT }>(
        `/accounts/${accountId()}/reports/agents/conversations?since=${since}&until=${until}`,
      );
      const rows = res.payload ?? [];
      // Normalise: Chatwoot may return time fields as seconds integers
      return rows.map(row => ({
        ...row,
        avg_first_response:
          typeof row.avg_first_response === 'number'
            ? formatSeconds(row.avg_first_response as unknown as number)
            : row.avg_first_response,
        avg_resolution:
          typeof row.avg_resolution === 'number'
            ? formatSeconds(row.avg_resolution as unknown as number)
            : row.avg_resolution,
      }));
    },
  });
}

// ─── Inbox performance report ─────────────────────────────────────────────────

export function useInboxReport(range: ReportRange) {
  const { since, until } = sinceUntil(range);
  return useQuery({
    queryKey: ['reportInboxes', range, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_INBOX_REPORT;
      const res = await cwFetch<{ payload?: typeof DEMO_INBOX_REPORT }>(
        `/accounts/${accountId()}/reports/inboxes/conversations?since=${since}&until=${until}`,
      );
      const rows = res.payload ?? [];
      return rows.map(row => ({
        ...row,
        avg_first_response:
          typeof row.avg_first_response === 'number'
            ? formatSeconds(row.avg_first_response as unknown as number)
            : row.avg_first_response,
        avg_resolution:
          typeof row.avg_resolution === 'number'
            ? formatSeconds(row.avg_resolution as unknown as number)
            : row.avg_resolution,
      }));
    },
  });
}

// ─── Team performance report ──────────────────────────────────────────────────

export function useTeamReport(range: ReportRange) {
  const { since, until } = sinceUntil(range);
  return useQuery({
    queryKey: ['reportTeams', range, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_TEAM_REPORT;
      const res = await cwFetch<{ payload?: typeof DEMO_TEAM_REPORT }>(
        `/accounts/${accountId()}/reports/teams/conversations?since=${since}&until=${until}`,
      );
      const rows = res.payload ?? [];
      return rows.map(row => ({
        ...row,
        avg_first_response:
          typeof row.avg_first_response === 'number'
            ? formatSeconds(row.avg_first_response as unknown as number)
            : row.avg_first_response,
        avg_resolution:
          typeof row.avg_resolution === 'number'
            ? formatSeconds(row.avg_resolution as unknown as number)
            : row.avg_resolution,
      }));
    },
  });
}
```

---

### Step B2 — Fix `OverviewReport.tsx` (BUG-05, BUG-06, BUG-07)

```tsx
'use client';

import { useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart,
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ReportRangeTabs } from '@/components/reports/ReportRangeTabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useReportSummary,
  useReportChart,
  useOverviewAgents,
  type ReportRange,
} from '@/lib/hooks/useReports';

export function OverviewReport() {
  const [range, setRange] = useState<ReportRange>('7d');
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useReportSummary(range);
  const { data: chartData = [], isLoading: chartLoading } = useReportChart(range);
  const { data: byAgent = [] } = useOverviewAgents(range);

  const isLoading = summaryLoading || chartLoading;

  const KPI_CARDS = [
    { label: 'Total conversations',  value: summary?.account?.conversations_count ?? 0 },
    { label: 'Resolved',             value: summary?.account?.resolved_conversations_count ?? 0 },
    { label: 'Avg first response',   value: summary?.account?.avg_first_response_time ?? '—' },
    { label: 'Avg resolution time',  value: summary?.account?.avg_resolution_time ?? '—' },
  ];

  // Dynamic YAxis width for agent names (BUG-07)
  const yAxisWidth = useMemo(() => {
    const longest = byAgent.reduce((max, a) => Math.max(max, a.name.length), 0);
    return Math.min(160, Math.max(100, longest * 7));
  }, [byAgent]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-lg font-semibold">Overview</h1>
        <ReportRangeTabs range={range} onChange={setRange} />
      </div>

      {summaryError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load report data. Check your Chatwoot connection.
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)
          : KPI_CARDS.map(card => (
              <div key={card.label} className="border rounded-lg p-4 bg-white">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-bold mt-1 text-brand-primary">{card.value}</p>
              </div>
            ))}
      </div>

      {/* Chart: conversations over time */}
      <div className="border rounded-lg p-4 bg-white">
        <h2 className="text-sm font-semibold mb-4">Conversations over time</h2>
        {chartLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : chartData.length === 0 ? (
          // BUG-06 fix: empty state instead of broken SVG
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
            No data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="open"     stroke="#0B5FFF" fill="#EFF6FF" name="Open" />
              <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="#ECFDF5" name="Resolved" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* By agent bar chart */}
      <div className="border rounded-lg p-4 bg-white">
        <h2 className="text-sm font-semibold mb-4">By agent (top 10)</h2>
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : byAgent.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
            No agent data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, byAgent.length * 36)}>
            <BarChart data={byAgent.slice(0, 10)} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              {/* BUG-07 fix: dynamic width */}
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={yAxisWidth} />
              <Tooltip />
              <Bar dataKey="count" fill="#0B5FFF" radius={[0, 4, 4, 0]} name="Conversations" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
```

---

### Step B3 — Fix `AgentReport.tsx` (BUG-08, BUG-09)

```tsx
// Fix BUG-08: use row.id ?? row.name as key
// Fix BUG-09: sort time fields by parsed seconds

import { parseDurationToSeconds } from '@/lib/hooks/useReports';

// In the sorted useMemo:
const sorted = useMemo(() => {
  return [...data].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortAsc ? av - bv : bv - av;
    }
    // For duration strings, parse to seconds (BUG-09)
    const timeKeys: SortKey[] = ['avg_first_response', 'avg_resolution', 'online_time'];
    if (timeKeys.includes(sortKey)) {
      const as = parseDurationToSeconds(String(av));
      const bs = parseDurationToSeconds(String(bv));
      return sortAsc ? as - bs : bs - as;
    }
    return sortAsc
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });
}, [data, sortKey, sortAsc]);

// In tbody row (BUG-08):
sorted.map((row, idx) => (
  <tr key={(row as { id?: number }).id ?? `${row.name}-${idx}`} className="border-b last:border-0 hover:bg-muted/20">
```

---

### Step B4 — Fix `InboxReport.tsx` and `TeamReport.tsx` (BUG-10)

In both files, add empty state in `tbody` when not loading and `data.length === 0`:

```tsx
{!isLoading && data.length === 0 && (
  <tr>
    <td
      colSpan={5}
      className="px-4 py-8 text-center text-sm text-muted-foreground"
    >
      No data for this period
    </td>
  </tr>
)}
```

Also add error state. Both hooks should expose `isError`:

```tsx
const { data = [], isLoading, isError } = useInboxReport(range);

// In JSX before the table:
{isError && (
  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive mb-4">
    Failed to load inbox report data.
  </div>
)}
```

---

### Step B5 — Fix `ReportsWorkspace.tsx` (BUG-11, BUG-12)

```tsx
'use client';

import { useState } from 'react';
import { BarChart2, Inbox, ShieldOff, Users, Users2 } from 'lucide-react';
import { OverviewReport } from '@/components/reports/OverviewReport';
import { AgentReport } from '@/components/reports/AgentReport';
import { InboxReport } from '@/components/reports/InboxReport';
import { TeamReport } from '@/components/reports/TeamReport';
import { can } from '@/lib/rbac';
import { useAuthStore } from '@/lib/store/auth';
import { cn } from '@/lib/utils/cn';

const NAV = [
  { id: 'overview', label: 'Overview',      icon: BarChart2 },
  { id: 'agents',   label: 'Agent reports', icon: Users },
  { id: 'inboxes',  label: 'Inbox reports', icon: Inbox },
  { id: 'teams',    label: 'Team reports',  icon: Users2 },
] as const;

type ReportView = (typeof NAV)[number]['id'];

export function ReportsWorkspace() {
  const [view, setView] = useState<ReportView>('overview');
  const role = useAuthStore(s => s.user?.role);

  // BUG-11 fix: RBAC gate
  if (!can(role, 'viewReports')) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <ShieldOff size={40} className="opacity-40" />
        <p className="text-sm">You don't have permission to view reports.</p>
      </div>
    );
  }

  // BUG-12 fix: only render the active view — no simultaneous hook calls
  function renderView() {
    switch (view) {
      case 'overview': return <OverviewReport />;
      case 'agents':   return <AgentReport />;
      case 'inboxes':  return <InboxReport />;
      case 'teams':    return <TeamReport />;
    }
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)] overflow-hidden">
      <nav className="w-[200px] shrink-0 border-e bg-muted/20 py-4 px-2" aria-label="Report sections">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-3">
          Reports
        </h2>
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={view === id ? 'page' : undefined}
            onClick={() => setView(id)}
            className={cn(
              'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm mb-0.5 text-start',
              view === id
                ? 'bg-blue-50 text-brand-primary font-medium'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <Icon size={15} aria-hidden />
            {label}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto min-w-0">
        {renderView()}
      </div>
    </div>
  );
}
```

---

### Step B6 — Fix `ReportRangeTabs.tsx` (BUG-13)

```tsx
'use client';

import { cn } from '@/lib/utils/cn';
import type { ReportRange } from '@/lib/hooks/useReports';

const RANGES: { value: ReportRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d',    label: 'Last 7 days' },
  { value: '30d',   label: 'Last 30 days' },
];

export function ReportRangeTabs({
  range,
  onChange,
}: {
  range: ReportRange;
  onChange: (r: ReportRange) => void;
}) {
  return (
    <div
      className="flex gap-1 border rounded-lg p-0.5"
      role="radiogroup"
      aria-label="Report date range"
    >
      {RANGES.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={range === value}
          onClick={() => onChange(value)}
          className={cn(
            'px-3 py-1 text-xs rounded-md transition-colors',
            range === value
              ? 'bg-brand-primary text-white'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

---

### Step B7 — Add CSV export to reports

Add a "Download CSV" button to `AgentReport`, `InboxReport`, and `TeamReport`. This is a standard production feature for any reporting UI.

**Create `src/lib/utils/exportCsv.ts`**:

```ts
/** Convert an array of objects to a CSV blob and trigger download */
export function downloadCsv(
  rows: Record<string, string | number>[],
  filename: string,
): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      headers
        .map(h => {
          const v = String(row[h] ?? '');
          return v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

In `AgentReport.tsx`, add export button in the header:

```tsx
import { Download } from 'lucide-react';
import { downloadCsv } from '@/lib/utils/exportCsv';

// In JSX header:
<button
  type="button"
  onClick={() => downloadCsv(
    sorted.map(r => ({
      Agent: r.name,
      Open: r.open,
      Resolved: r.resolved,
      'Avg First Response': r.avg_first_response,
      'Avg Resolution': r.avg_resolution,
      'Online Time': r.online_time,
    })),
    `agent-report-${range}-${new Date().toISOString().slice(0, 10)}.csv`,
  )}
  disabled={isLoading || data.length === 0}
  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg hover:bg-muted disabled:opacity-50"
>
  <Download size={13} /> Export CSV
</button>
```

Apply the same pattern to `InboxReport` and `TeamReport`.

---

## Verification Checklist

**Part A — SIP guard:**
- [ ] Navigate directly to `/contacts` (without visiting `/calling`) → SIP registers in background within a few seconds
- [ ] Call button on a contact while SIP is registering shows grey icon (not brand-primary)
- [ ] Once registered, icon turns brand-primary; clicking initiates call
- [ ] If SIP env vars are missing, toast "SIP not connected" appears on click — no console errors
- [ ] Network tab: only ONE `REGISTER` request per session (not one per contact viewed)

**Part B — Reports:**
- [ ] **BUG-01**: Overview KPIs show real numbers from Chatwoot in production; `avg_first_response_time` shows "4m 12s" not a raw integer
- [ ] **BUG-02**: Changing range to "Last 30 days" updates all four tabs with fresh data (network tab shows `since=` and `until=` as Unix timestamps)
- [ ] **BUG-03**: Network tab for report requests shows `since=1716854400&until=1717545600` (Unix integers) — NOT `since=2026-05-25`
- [ ] **BUG-04**: With API down in production → reports show error banners, not LABBIK demo data
- [ ] **BUG-05**: Conversations chart loads data from separate `/reports?metric=account_conversations` endpoint
- [ ] **BUG-06**: Switching to "Today" on a quiet day shows "No data for this period" in the chart area — no broken SVG
- [ ] **BUG-07**: Agent bar chart with long Arabic names (20+ chars) — no name truncation in the Y axis
- [ ] **BUG-08**: Two agents with the same name → both rows appear in the table (no React key collision warning in console)
- [ ] **BUG-09**: Sort by "Avg first response" → `"1h 55m"` appears after `"4m 05s"` when sorted ascending (1h > 4m)
- [ ] **BUG-10**: Switch to a range with no resolved conversations → table shows "No data for this period" row, not empty tbody
- [ ] **BUG-11**: Log in as agent role → navigate to `/reports` → access denied message shown
- [ ] **BUG-12**: Open DevTools → Network → navigate from Overview to Agent reports → only agent report queries fire (not all four simultaneously)
- [ ] **BUG-13**: VoiceOver/axe — range tabs announce as radio buttons with checked state
- [ ] **CSV Export**: clicking "Export CSV" on Agent report downloads a `.csv` with correct headers and data

---

## Acceptance Criteria

1. Reports load in < 1s on LAN; skeleton shown during fetch
2. Range switching invalidates and refetches only affected queries
3. KPI numbers match Chatwoot dashboard for the same date range
4. All time values displayed as human strings (not raw seconds)
5. Charts render without errors on empty data; meaningful empty state shown
6. Agent table sortable on all columns including time durations (correct numeric sort)
7. CSV export works for all three detail report tabs
8. RBAC enforced — agent role sees access-denied, not report data
9. SIP initialises on dashboard mount; Call button in Contacts responds immediately when SIP is ready
10. No duplicate SIP REGISTER requests visible in network tab

---

## Files Modified (summary)

| File | Changes |
|------|---------|
| `src/components/calling/SipInitializer.tsx` | CREATE — mounts useJsSip() at dashboard level |
| `src/app/(dashboard)/layout.tsx` | Add `<SipInitializer />` |
| `src/components/contacts/ContactDetailPanel.tsx` | Call button shows toast when SIP not ready; uses `sipRegistered` state |
| `src/lib/hooks/useReports.ts` | Full rewrite: Unix timestamps, correct API paths, real response parsing, `formatSeconds`, `parseDurationToSeconds`, `useReportChart`, `useOverviewAgents` |
| `src/lib/utils/exportCsv.ts` | CREATE — CSV download utility |
| `src/components/reports/OverviewReport.tsx` | Separate chart query, dynamic YAxis, empty states, error banner |
| `src/components/reports/AgentReport.tsx` | Stable key, duration-aware sort, CSV export |
| `src/components/reports/InboxReport.tsx` | Empty state, error state, CSV export |
| `src/components/reports/TeamReport.tsx` | Empty state, error state, CSV export |
| `src/components/reports/ReportsWorkspace.tsx` | RBAC guard, lazy render (no simultaneous hook calls), aria-current |
| `src/components/reports/ReportRangeTabs.tsx` | role="radiogroup", aria-checked |
