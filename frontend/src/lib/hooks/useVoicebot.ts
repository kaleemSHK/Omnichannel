'use client';

/**
 * React Query hooks for voicebot analytics — Sprint 3 V1.
 */

import { useQuery } from '@tanstack/react-query';
import { getVoicebotAnalytics, getSessionTranscript } from '@/lib/api/voicebot';
import { isDemoDataEnabled, isGatewayQueryEnabled } from '@/lib/demo/config';
import {
  DEMO_VOICEBOT_ANALYTICS,
  DEMO_VOICEBOT_TRANSCRIPT,
} from '@/lib/demo/voicebotFixture';
import type { VoicebotAnalytics, VoicebotTranscript } from '@/lib/api/voicebot';

/** Range helper — returns Unix seconds for 'today' | '7d' | '30d'. */
function rangeToUnix(range: 'today' | '7d' | '30d'): { since: number; until: number } {
  const now = Math.floor(Date.now() / 1000);
  const day = 86_400;
  if (range === 'today') return { since: now - day, until: now };
  if (range === '7d')    return { since: now - 7 * day, until: now };
  return                        { since: now - 30 * day, until: now };
}

/**
 * useVoicebotAnalytics — returns aggregated voicebot KPIs.
 * Falls back to demo data when gateway is unavailable or demo mode is active.
 */
export function useVoicebotAnalytics(range: 'today' | '7d' | '30d' = '7d') {
  const { since, until } = rangeToUnix(range);
  const gwEnabled = isGatewayQueryEnabled();

  return useQuery<VoicebotAnalytics>({
    queryKey: ['voicebotAnalytics', range],
    queryFn: async () => {
      if (isDemoDataEnabled() || !gwEnabled) return DEMO_VOICEBOT_ANALYTICS;
      try {
        return await getVoicebotAnalytics(since, until);
      } catch {
        return DEMO_VOICEBOT_ANALYTICS;
      }
    },
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

/**
 * useSessionTranscript — fetches the turn-by-turn transcript for a session.
 * Enabled only when a sessionId is provided.
 */
export function useSessionTranscript(sessionId: string | null) {
  const gwEnabled = isGatewayQueryEnabled();

  return useQuery<VoicebotTranscript>({
    queryKey: ['sessionTranscript', sessionId],
    queryFn: async () => {
      if (!sessionId) throw new Error('No session ID');
      if (isDemoDataEnabled() || !gwEnabled) {
        return DEMO_VOICEBOT_TRANSCRIPT as VoicebotTranscript;
      }
      return getSessionTranscript(sessionId);
    },
    enabled: !!sessionId,
    staleTime: 60_000,
  });
}
