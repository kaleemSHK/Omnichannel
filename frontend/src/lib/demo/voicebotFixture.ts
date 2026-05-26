/**
 * Demo fixtures for Sprint 3 V1 Voicebot FSM analytics.
 * Used when gateway is not available or demo mode is active.
 */

import type { VoicebotAnalytics } from '@/lib/api/voicebot';

export const DEMO_VOICEBOT_ANALYTICS: VoicebotAnalytics = {
  total_sessions: 347,
  escalated_sessions: 89,
  completed_sessions: 241,
  avg_misunderstandings: 1.2,
  avg_turns_to_handoff: 3.4,
  escalation_rate: 25.6,
  intent_distribution: [
    { intent: 'billing_inquiry',   count: 142 },
    { intent: 'technical_support', count: 98  },
    { intent: 'plan_change',       count: 61  },
    { intent: 'complaint',         count: 27  },
    { intent: 'unrecognized',      count: 19  },
  ],
  avg_stt_ms: 420,
  avg_llm_ms: 680,
  avg_tts_ms: 310,
  daily_sessions: [
    { date: '2026-05-21', sessions: 43 },
    { date: '2026-05-22', sessions: 57 },
    { date: '2026-05-23', sessions: 49 },
    { date: '2026-05-24', sessions: 61 },
    { date: '2026-05-25', sessions: 38 },
    { date: '2026-05-26', sessions: 52 },
    { date: '2026-05-27', sessions: 47 },
  ],
};

export const DEMO_VOICEBOT_SESSIONS = [
  {
    id: 'sess-001',
    call_id: 'call-8821',
    state: 'ended',
    language: 'ar-OM',
    created_at: '2026-05-27T09:12:00Z',
    ended_at: '2026-05-27T09:15:43Z',
    misunderstanding_count: 1,
    transfer_to_queue_id: null,
  },
  {
    id: 'sess-002',
    call_id: 'call-8835',
    state: 'transferring',
    language: 'ar-OM',
    created_at: '2026-05-27T10:01:00Z',
    ended_at: '2026-05-27T10:03:22Z',
    misunderstanding_count: 0,
    transfer_to_queue_id: 'billing',
  },
  {
    id: 'sess-003',
    call_id: 'call-8851',
    state: 'ended',
    language: 'ar-OM',
    created_at: '2026-05-27T11:30:00Z',
    ended_at: '2026-05-27T11:34:11Z',
    misunderstanding_count: 2,
    transfer_to_queue_id: null,
  },
];

export const DEMO_VOICEBOT_TRANSCRIPT = {
  session: DEMO_VOICEBOT_SESSIONS[1],
  turns: [
    {
      turn_index: 0,
      transcript: 'أريد الاستفسار عن فاتورتي',
      intent: 'billing_inquiry',
      response_text: 'يسعدني مساعدتك في الاستفسار عن الفاتورة.',
      barge_in: false,
      stt_latency_ms: 380,
      llm_latency_ms: 650,
      tts_latency_ms: 290,
    },
    {
      turn_index: 1,
      transcript: 'الفاتورة هذا الشهر مرتفعة جداً',
      intent: 'billing_inquiry',
      response_text: 'سأقوم بتحويلك إلى قسم الفواتير لمراجعة حسابك.',
      barge_in: false,
      stt_latency_ms: 410,
      llm_latency_ms: 720,
      tts_latency_ms: 310,
    },
  ],
};
