/**
 * Voicebot API client — Sprint 3 V1
 * Routes through the gateway to the ai service.
 */

import { bnFetch } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntentCount {
  intent: string;
  count: number;
}

export interface DailySessionCount {
  date: string;     // ISO date string 'YYYY-MM-DD'
  sessions: number;
}

export interface VoicebotAnalytics {
  total_sessions: number;
  escalated_sessions: number;
  completed_sessions: number;
  avg_misunderstandings: number;
  avg_turns_to_handoff: number;
  /** 0–100 percentage */
  escalation_rate: number;
  intent_distribution: IntentCount[];
  avg_stt_ms: number;
  avg_llm_ms: number;
  avg_tts_ms: number;
  daily_sessions: DailySessionCount[];
}

export interface VoicebotSession {
  id: string;
  call_id: string;
  state: 'greeting' | 'listening' | 'responding' | 'transferring' | 'ended';
  language: string;
  created_at: string;
  ended_at: string | null;
  misunderstanding_count: number;
  transfer_to_queue_id: string | null;
}

export interface VoicebotTurn {
  turn_index: number;
  transcript: string;
  intent: string;
  response_text: string;
  barge_in: boolean;
  stt_latency_ms: number;
  llm_latency_ms: number;
  tts_latency_ms: number;
}

export interface VoicebotTranscript {
  session: VoicebotSession;
  turns: VoicebotTurn[];
}

// ─── API functions ─────────────────────────────────────────────────────────────

/** Fetch aggregated voicebot KPIs for a time window (Unix seconds). */
export async function getVoicebotAnalytics(since?: number, until?: number): Promise<VoicebotAnalytics> {
  const params = new URLSearchParams();
  if (since !== undefined) params.set('since', String(since));
  if (until !== undefined) params.set('until', String(until));
  const qs = params.size ? `?${params.toString()}` : '';
  return bnFetch<VoicebotAnalytics>('ai', `/v1/voicebot/analytics${qs}`);
}

/** Fetch the turn-by-turn transcript for a single voice session. */
export async function getSessionTranscript(sessionId: string): Promise<VoicebotTranscript> {
  return bnFetch<VoicebotTranscript>('ai', `/v1/voice/sessions/${sessionId}/transcript`);
}
