'use client';

import { useQuery } from '@tanstack/react-query';
import { listCDR } from '@/lib/api/calls';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { phonesMatch } from '@/lib/utils/find-contact-by-phone';
import type { CDRRecord } from '@/types';

export interface CallerRecordingRow {
  recordingId: string;
  callSessionId: string;
  direction?: CDRRecord['direction'];
  duration: number;
  startedAt: string;
}

function mapRow(r: CDRRecord): CallerRecordingRow | null {
  if (!r.recordingId) return null;
  return {
    recordingId: r.recordingId,
    callSessionId: r.callSessionId ?? r.id,
    direction: r.direction,
    duration: r.duration,
    startedAt: r.startedAt,
  };
}

async function loadCallerRecordings(
  customerPhone: string,
  transport?: 'pstn' | 'whatsapp' | 'webrtc',
): Promise<CallerRecordingRow[]> {
  if (isDemoDataEnabled()) {
    const { DEMO_CDR } = await import('@/lib/demo/callingFixture');
    return DEMO_CDR.filter(
      r =>
        phonesMatch(r.customerPhone ?? '', customerPhone) &&
        (!transport || r.transport === transport),
    )
      .map(mapRow)
      .filter((r): r is CallerRecordingRow => r != null);
  }

  const res = await listCDR({
    customerPhone,
    transport,
    hasRecording: true,
    limit: 50,
    page: 1,
  });
  const rows = (res as { data?: CDRRecord[] }).data ?? [];
  return rows.map(mapRow).filter((r): r is CallerRecordingRow => r != null);
}

export function useCallRecordings(opts: {
  customerPhone?: string | null;
  transport?: 'pstn' | 'whatsapp' | 'webrtc';
  enabled?: boolean;
}) {
  const phone = opts.customerPhone?.trim() ?? '';
  const enabled = opts.enabled !== false && phone.length > 0;

  return useQuery({
    queryKey: ['call-recordings', phone, opts.transport ?? '', isDemoDataEnabled()],
    queryFn: () => loadCallerRecordings(phone, opts.transport),
    enabled,
    staleTime: 30_000,
  });
}
