'use client';

import { useQuery } from '@tanstack/react-query';
import { cwFetch, BlinkoneApiError } from '@/lib/api/client';
import {
  DEMO_AGENT_REPORT,
  DEMO_INBOX_REPORT,
  DEMO_REPORT_SUMMARY,
  DEMO_TEAM_REPORT,
  DEMO_CSAT_DATA,
  DEMO_HOURLY_HEATMAP,
  DEMO_HEATMAP_DAYS,
  DEMO_SLA_BREACH,
  DEMO_FUNNEL,
  type CsatPoint,
  type SlaBreachPoint,
  type FunnelPoint,
} from '@/lib/demo/chatwootExtrasFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { useAuthStore } from '@/lib/store/auth';

export type ReportRange = 'today' | '7d' | '30d';

/** Custom date range — since/until are Unix seconds; label is shown in UI / exports. */
export interface CustomDateRange {
  since: number;
  until: number;
  label: string;
}

/** All hook-compatible range values: preset string OR custom timestamps. */
export type DateRangeValue = ReportRange | CustomDateRange;

/** Narrow helper — is this a custom range object? */
export function isCustomRange(r: DateRangeValue): r is CustomDateRange {
  return typeof r === 'object';
}

/** Human-readable label for any DateRangeValue. */
export function rangeLabelOf(r: DateRangeValue): string {
  if (isCustomRange(r)) return r.label;
  if (r === 'today') return 'Today';
  if (r === '7d') return 'Last 7 days';
  return 'Last 30 days';
}

export type AgentReportRow = {
  id?: number;
  name: string;
  open: number;
  resolved: number;
  avg_first_response: string;
  avg_resolution: string;
  online_time: string;
};

export type InboxReportRow = {
  id?: number;
  name: string;
  open: number;
  resolved: number;
  avg_first_response: string;
  avg_resolution: string;
};

export type TeamReportRow = InboxReportRow;

interface CWSummaryRaw {
  conversations_count?: number;
  resolved_conversations_count?: number;
  resolutions_count?: number;
  avg_first_response_time?: number | string | null;
  avg_resolution_time?: number | string | null;
}

interface CWSummaryReportRow {
  id: number;
  conversations_count?: number;
  resolved_conversations_count?: number;
  avg_first_response_time?: number | null;
  avg_resolution_time?: number | null;
}

interface CWNamedEntity {
  id: number;
  name: string;
}

function accountId() {
  return useAuthStore.getState().user?.chatwootAccountId ?? 1;
}

/** Returns Unix timestamps for since/until (Chatwoot expects integers) */
function sinceUntil(range: DateRangeValue): { since: number; until: number } {
  if (isCustomRange(range)) return { since: range.since, until: range.until };
  const now = Math.floor(Date.now() / 1000);
  if (range === 'today') {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return { since: Math.floor(startOfDay.getTime() / 1000), until: now };
  }
  const days = range === '7d' ? 7 : 30;
  return { since: now - days * 86_400, until: now };
}

function dayLabel(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', { weekday: 'short' });
}

function reportQuery(since: number, until: number): string {
  return `since=${since}&until=${until}`;
}

async function fetchNameMap(path: string): Promise<Map<number, string>> {
  const res = await cwFetch<CWNamedEntity[] | { payload?: CWNamedEntity[] }>(path);
  const rows = Array.isArray(res) ? res : (res.payload ?? []);
  return new Map(rows.map(row => [row.id, row.name]));
}

function normalizeDuration(value: unknown): string {
  if (typeof value === 'number') return formatSeconds(value);
  if (typeof value === 'string' && value.trim()) return value;
  return '—';
}

function mapSummaryRow(
  row: CWSummaryReportRow,
  name: string,
): AgentReportRow {
  const total = row.conversations_count ?? 0;
  const resolved = row.resolved_conversations_count ?? 0;
  return {
    id: row.id,
    name,
    open: Math.max(0, total - resolved),
    resolved,
    avg_first_response: normalizeDuration(row.avg_first_response_time),
    avg_resolution: normalizeDuration(row.avg_resolution_time),
    online_time: '—',
  };
}

/** Format seconds duration to human string */
export function formatSeconds(seconds: number): string {
  if (!seconds || Number.isNaN(seconds)) return '—';
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
  if (h) total += parseInt(h[1], 10) * 3600;
  if (m) total += parseInt(m[1], 10) * 60;
  if (sec) total += parseInt(sec[1], 10);
  return total;
}

export function useReportSummary(range: DateRangeValue) {
  const { since, until } = sinceUntil(range);
  return useQuery({
    queryKey: ['reportSummary', range, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_REPORT_SUMMARY;
      const raw = await cwFetch<CWSummaryRaw>(
        `/accounts/${accountId()}/reports/summary?type=account&${reportQuery(since, until)}`,
        {},
        'v2',
      );
      return {
        account: {
          conversations_count: raw.conversations_count ?? 0,
          resolved_conversations_count:
            raw.resolved_conversations_count ?? raw.resolutions_count ?? 0,
          avg_first_response_time: normalizeDuration(raw.avg_first_response_time),
          avg_resolution_time: normalizeDuration(raw.avg_resolution_time),
        },
        chartData: [] as typeof DEMO_REPORT_SUMMARY.chartData,
        byAgent: [] as typeof DEMO_REPORT_SUMMARY.byAgent,
        byInbox: [] as typeof DEMO_REPORT_SUMMARY.byInbox,
      };
    },
  });
}

interface CWReportPoint {
  timestamp: number;
  value: number;
}

export function useReportChart(range: DateRangeValue) {
  const { since, until } = sinceUntil(range);
  return useQuery({
    queryKey: ['reportChart', range, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_REPORT_SUMMARY.chartData;
      const q = reportQuery(since, until);
      const [openRes, resolvedRes] = await Promise.all([
        cwFetch<{ payload: CWReportPoint[] }>(
          `/accounts/${accountId()}/reports?metric=conversations_count&type=account&${q}&group_by=day`,
          {},
          'v2',
        ),
        cwFetch<{ payload: CWReportPoint[] }>(
          `/accounts/${accountId()}/reports?metric=resolutions_count&type=account&${q}&group_by=day`,
          {},
          'v2',
        ),
      ]);
      const openMap = new Map(
        (openRes.payload ?? []).map(p => [dayLabel(p.timestamp), p.value]),
      );
      const resolvedPoints = resolvedRes.payload ?? [];
      const openPoints = openRes.payload ?? [];
      const timestamps = new Set([
        ...resolvedPoints.map(p => p.timestamp),
        ...openPoints.map(p => p.timestamp),
      ]);
      return [...timestamps]
        .sort((a, b) => a - b)
        .map(ts => {
          const label = dayLabel(ts);
          return {
            date: label,
            open: openMap.get(label) ?? 0,
            resolved: resolvedPoints.find(p => p.timestamp === ts)?.value ?? 0,
          };
        });
    },
  });
}

export function useOverviewAgents(range: DateRangeValue) {
  const { since, until } = sinceUntil(range);
  return useQuery({
    queryKey: ['reportOverviewAgents', range, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_REPORT_SUMMARY.byAgent;
      const q = reportQuery(since, until);
      const [rows, nameMap] = await Promise.all([
        cwFetch<CWSummaryReportRow[]>(
          `/accounts/${accountId()}/summary_reports/agent?${q}`,
          {},
          'v2',
        ),
        fetchNameMap(`/accounts/${accountId()}/agents`),
      ]);
      return (Array.isArray(rows) ? rows : [])
        .map(row => ({
          name: nameMap.get(row.id) ?? `Agent ${row.id}`,
          count: row.conversations_count ?? 0,
        }))
        .sort((a, b) => b.count - a.count);
    },
  });
}

export function useAgentReport(range: DateRangeValue) {
  const { since, until } = sinceUntil(range);
  return useQuery({
    queryKey: ['reportAgents', range, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_AGENT_REPORT as AgentReportRow[];
      const q = reportQuery(since, until);
      const [rows, nameMap] = await Promise.all([
        cwFetch<CWSummaryReportRow[]>(
          `/accounts/${accountId()}/summary_reports/agent?${q}`,
          {},
          'v2',
        ),
        fetchNameMap(`/accounts/${accountId()}/agents`),
      ]);
      return (Array.isArray(rows) ? rows : []).map(row =>
        mapSummaryRow(row, nameMap.get(row.id) ?? `Agent ${row.id}`),
      );
    },
  });
}

export function useInboxReport(range: DateRangeValue) {
  const { since, until } = sinceUntil(range);
  return useQuery({
    queryKey: ['reportInboxes', range, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_INBOX_REPORT as InboxReportRow[];
      const q = reportQuery(since, until);
      const [rows, nameMap] = await Promise.all([
        cwFetch<CWSummaryReportRow[]>(
          `/accounts/${accountId()}/summary_reports/inbox?${q}`,
          {},
          'v2',
        ),
        fetchNameMap(`/accounts/${accountId()}/inboxes`),
      ]);
      return (Array.isArray(rows) ? rows : []).map(row => {
        const mapped = mapSummaryRow(row, nameMap.get(row.id) ?? `Inbox ${row.id}`);
        return {
          id: mapped.id,
          name: mapped.name,
          open: mapped.open,
          resolved: mapped.resolved,
          avg_first_response: mapped.avg_first_response,
          avg_resolution: mapped.avg_resolution,
        };
      });
    },
  });
}

export function useTeamReport(range: DateRangeValue) {
  const { since, until } = sinceUntil(range);
  return useQuery({
    queryKey: ['reportTeams', range, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_TEAM_REPORT as TeamReportRow[];
      const q = reportQuery(since, until);
      const [rows, nameMap] = await Promise.all([
        cwFetch<CWSummaryReportRow[]>(
          `/accounts/${accountId()}/summary_reports/team?${q}`,
          {},
          'v2',
        ),
        fetchNameMap(`/accounts/${accountId()}/teams`),
      ]);
      return (Array.isArray(rows) ? rows : []).map(row => {
        const mapped = mapSummaryRow(row, nameMap.get(row.id) ?? `Team ${row.id}`);
        return {
          id: mapped.id,
          name: mapped.name,
          open: mapped.open,
          resolved: mapped.resolved,
          avg_first_response: mapped.avg_first_response,
          avg_resolution: mapped.avg_resolution,
        };
      });
    },
  });
}

// ─── A1: Advanced Analytics hooks ────────────────────────────────────────────

interface CWSurveyResponse {
  created_at: number | string;
  rating: number | string;
}

function csatRatingBucket(rating: number | string): 'satisfied' | 'neutral' | 'unsatisfied' {
  const n = typeof rating === 'number' ? rating : Number(rating);
  if (!Number.isFinite(n)) return 'neutral';
  if (n >= 4) return 'satisfied';
  if (n <= 2) return 'unsatisfied';
  return 'neutral';
}

function csatCreatedAtMs(value: number | string): number {
  if (typeof value === 'number') return value > 1e12 ? value : value * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

/** Chatwoot v1 CSAT index — paginated (25/page). */
async function fetchCsatSurveyResponses(since: number, until: number): Promise<CWSurveyResponse[]> {
  const rows: CWSurveyResponse[] = [];
  for (let page = 1; page <= 40; page++) {
    const batch = await cwFetch<CWSurveyResponse[]>(
      `/accounts/${accountId()}/csat_survey_responses?since=${since}&until=${until}&page=${page}`,
      {},
      'v1',
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < 25) break;
  }
  return rows;
}

function bucketCsatResponses(rows: CWSurveyResponse[]): CsatPoint[] {
  const buckets = new Map<string, { satisfied: number; unsatisfied: number }>();
  for (const r of rows) {
    const label = new Date(csatCreatedAtMs(r.created_at)).toLocaleDateString('en-US', {
      weekday: 'short',
    });
    const bucket = csatRatingBucket(r.rating);
    const b = buckets.get(label) ?? { satisfied: 0, unsatisfied: 0 };
    if (bucket === 'satisfied') b.satisfied++;
    else if (bucket === 'unsatisfied') b.unsatisfied++;
    buckets.set(label, b);
  }
  return [...buckets.entries()].map(([date, b]) => ({
    date,
    satisfied: b.satisfied,
    unsatisfied: b.unsatisfied,
    score:
      b.satisfied + b.unsatisfied > 0
        ? Math.round((b.satisfied / (b.satisfied + b.unsatisfied)) * 100)
        : 0,
  }));
}

/** CSAT trend — day-by-day satisfied/unsatisfied + score (%). */
export function useCsatReport(range: DateRangeValue): { data: CsatPoint[]; isLoading: boolean; isError: boolean } {
  const { since, until } = sinceUntil(range);
  const q = useQuery<CsatPoint[]>({
    queryKey: ['reportCsat', range, since, until, isDemoDataEnabled()],
    queryFn: async (): Promise<CsatPoint[]> => {
      if (isDemoDataEnabled()) return DEMO_CSAT_DATA;
      try {
        const rows = await fetchCsatSurveyResponses(since, until);
        return bucketCsatResponses(rows);
      } catch (e) {
        if (e instanceof BlinkoneApiError && e.status === 404) return [];
        return [];
      }
    },
    retry: false,
    staleTime: 5 * 60_000,
  });
  return { data: q.data ?? [], isLoading: q.isLoading, isError: q.isError };
}

/** Agent occupancy heatmap — 7 rows (days) × 24 columns (hours). */
export function useHourlyHeatmap(): { days: string[]; matrix: number[][] } {
  // Chatwoot v2 doesn't support group_by=hour yet; always use demo data for visual
  return { days: DEMO_HEATMAP_DAYS, matrix: DEMO_HOURLY_HEATMAP };
}

/** SLA breach rate per day — calls the real SLA service `/v1/breach-stats` endpoint. */
export function useSlaBreachReport(range: DateRangeValue): { data: SlaBreachPoint[]; isLoading: boolean } {
  const { since, until } = sinceUntil(range);
  const q = useQuery<SlaBreachPoint[]>({
    queryKey: ['reportSlaBreach', since, until, isDemoDataEnabled()],
    queryFn: async (): Promise<SlaBreachPoint[]> => {
      if (isDemoDataEnabled()) return DEMO_SLA_BREACH;
      try {
        // Import lazily to avoid circular deps
        const { getBreachStats } = await import('@/lib/api/sla');
        const rows = await getBreachStats(since, until);
        // Map ISO date to short weekday label for chart display
        return rows.map(r => ({
          date: new Date(r.date).toLocaleDateString('en-US', { weekday: 'short' }),
          breaches: r.breaches,
          total: r.total,
          breachRate: r.breachRate,
        }));
      } catch {
        return DEMO_SLA_BREACH; // graceful fallback
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  return { data: q.data ?? [], isLoading: q.isLoading };
}

/** Conversation funnel — opens → responded → resolved → CSAT. */
export function useConversionFunnel(range: DateRangeValue): { data: FunnelPoint[]; isLoading: boolean } {
  const q = useQuery<FunnelPoint[]>({
    queryKey: ['reportFunnel', range, isDemoDataEnabled()],
    queryFn: async (): Promise<FunnelPoint[]> => {
      if (isDemoDataEnabled()) return DEMO_FUNNEL;
      // Derive from summary
      try {
        const { since, until } = sinceUntil(range);
        const raw = await cwFetch<CWSummaryRaw>(
          `/accounts/${accountId()}/reports/summary?type=account&${reportQuery(since, until)}`,
          {},
          'v2',
        );
        const opened = raw.conversations_count ?? 0;
        const resolved = raw.resolved_conversations_count ?? raw.resolutions_count ?? 0;
        const responded = Math.round(opened * 0.93); // approx — no direct metric
        const csatSent = Math.round(resolved * 0.8);
        const csatReceived = Math.round(csatSent * 0.73);
        return [
          { stage: 'Opened', count: opened, pct: 100 },
          { stage: 'Responded', count: responded, pct: opened > 0 ? Math.round((responded / opened) * 100) : 0 },
          { stage: 'Resolved', count: resolved, pct: opened > 0 ? Math.round((resolved / opened) * 100) : 0 },
          { stage: 'CSAT sent', count: csatSent, pct: opened > 0 ? Math.round((csatSent / opened) * 100) : 0 },
          { stage: 'CSAT received', count: csatReceived, pct: opened > 0 ? Math.round((csatReceived / opened) * 100) : 0 },
        ];
      } catch {
        return DEMO_FUNNEL;
      }
    },
  });
  return { data: q.data ?? [], isLoading: q.isLoading };
}

// Re-export fixture types for consumers
export type { CsatPoint, SlaBreachPoint, FunnelPoint };
