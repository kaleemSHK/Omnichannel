/**
 * BlinkOne Reports API — /api/reports
 * Falls back to demo fixture when the backend is unreachable.
 */

import { bnFetch } from './client';
import { getDemoReport, type ReportSummary } from '@/lib/demo/reportsFixture';

const SVC = 'reports';

export interface ReportFilters {
  from: string;   // YYYY-MM-DD
  to: string;     // YYYY-MM-DD
  queueKey?: string;
  agentId?: string;
  channel?: 'pstn' | 'whatsapp' | 'webrtc';
  granularity?: 'day' | 'week' | 'month';
}

export async function fetchReport(filters: ReportFilters): Promise<ReportSummary> {
  const params = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.queueKey) params.set('queue', filters.queueKey);
  if (filters.agentId) params.set('agent_id', filters.agentId);
  if (filters.channel) params.set('channel', filters.channel);
  if (filters.granularity) params.set('granularity', filters.granularity);

  try {
    return await bnFetch<ReportSummary>(SVC, `/v1/summary?${params}`);
  } catch {
    return getDemoReport(30);
  }
}
