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

function sinceDate(range: ReportRange): string {
  if (range === 'today') return new Date().toISOString().slice(0, 10);
  const days = range === '7d' ? 7 : 30;
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export function useReportSummary(range: ReportRange) {
  const since = sinceDate(range);
  const until = new Date().toISOString().slice(0, 10);

  return useQuery({
    queryKey: ['reportSummary', range, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_REPORT_SUMMARY;
      try {
        return await cwFetch<typeof DEMO_REPORT_SUMMARY>(
          `/accounts/${accountId()}/reports/summary?since=${since}&until=${until}`,
        );
      } catch {
        return DEMO_REPORT_SUMMARY;
      }
    },
  });
}

export function useAgentReport(range: ReportRange) {
  const since = sinceDate(range);
  const until = new Date().toISOString().slice(0, 10);

  return useQuery({
    queryKey: ['reportAgents', range, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_AGENT_REPORT;
      try {
        const res = await cwFetch<{ payload?: typeof DEMO_AGENT_REPORT }>(
          `/accounts/${accountId()}/reports/agents/conversations?since=${since}&until=${until}`,
        );
        return res.payload ?? DEMO_AGENT_REPORT;
      } catch {
        return DEMO_AGENT_REPORT;
      }
    },
  });
}

export function useInboxReport(range: ReportRange) {
  const since = sinceDate(range);
  const until = new Date().toISOString().slice(0, 10);

  return useQuery({
    queryKey: ['reportInboxes', range, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_INBOX_REPORT;
      try {
        const res = await cwFetch<{ payload?: typeof DEMO_INBOX_REPORT }>(
          `/accounts/${accountId()}/reports/inboxes/conversations?since=${since}&until=${until}`,
        );
        return res.payload ?? DEMO_INBOX_REPORT;
      } catch {
        return DEMO_INBOX_REPORT;
      }
    },
  });
}

export function useTeamReport(range: ReportRange) {
  const since = sinceDate(range);
  const until = new Date().toISOString().slice(0, 10);

  return useQuery({
    queryKey: ['reportTeams', range, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_TEAM_REPORT;
      try {
        const res = await cwFetch<{ payload?: typeof DEMO_TEAM_REPORT }>(
          `/accounts/${accountId()}/reports/teams/conversations?since=${since}&until=${until}`,
        );
        return res.payload ?? DEMO_TEAM_REPORT;
      } catch {
        return DEMO_TEAM_REPORT;
      }
    },
  });
}
