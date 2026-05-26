'use client';

import { useQuery } from '@tanstack/react-query';
import { getVoicebotStatus } from '@/lib/api/ai';

export function VoiceBotStatus() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['voicebot-status'],
    queryFn: getVoicebotStatus,
    refetchInterval: 30_000,
  });

  const isLive = (data?.active_sessions ?? 0) > 0;
  const sttLabel = data?.stt_mode?.startsWith('whisper_')
    ? `Whisper (${data.stt_mode.replace('whisper_', '')})`
    : data?.stt_mode === 'google_chirp_v2'
      ? 'Google Chirp v2'
      : 'Stub';
  const ttsLabel = data?.tts_mode === 'piper_arabic' ? 'Piper (Arabic)' : 'Stub';

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/80 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`size-2 rounded-full shrink-0 ${
            isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
          }`}
          aria-hidden
        />
        <h3 className="text-sm font-medium text-gray-900">Arabic Voice Bot</h3>
      </div>
      <div className="text-xs text-gray-600 space-y-1">
        {isLoading && <p>Loading status…</p>}
        {isError && <p className="text-amber-700">Voice bot status unavailable</p>}
        {!isLoading && !isError && (
          <>
            <p>Language: {data?.language ?? 'ar-OM'} (ar-OM / ar-SA)</p>
            <p>STT: {sttLabel}</p>
            <p>TTS: {ttsLabel}</p>
            <p>Voice: {data?.piper_voice ?? 'ar_JO-kareem-medium'}</p>
            <p>Active sessions: {data?.active_sessions ?? 0}</p>
          </>
        )}
      </div>
    </div>
  );
}
