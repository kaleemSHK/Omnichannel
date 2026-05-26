'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { listRecordings, fetchRecordingAudioBlob } from '@/lib/api/recording';
import { useAuthStore } from '@/lib/store/auth';

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RecordingsPanel() {
  const accountId = useAuthStore(s => s.user?.chatwootAccountId);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  const { data: recordings = [], isLoading, isError } = useQuery({
    queryKey: ['recordings', accountId],
    queryFn: () => listRecordings(),
    enabled: !!accountId,
    refetchInterval: 60_000,
  });

  async function playRecording(id: string) {
    if (playingId === id) {
      audioEl?.pause();
      setPlayingId(null);
      return;
    }

    try {
      audioEl?.pause();
      const blob = await fetchRecordingAudioBlob(id);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPlayingId(null);
      };
      await audio.play();
      setAudioEl(audio);
      setPlayingId(id);
    } catch {
      toast.error('Failed to load recording — it may still be processing');
    }
  }

  async function downloadRecording(id: string, callSessionId: string) {
    try {
      const blob = await fetchRecordingAudioBlob(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${callSessionId || id}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed — recording may not be available yet');
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 p-4 bg-white shadow-sm space-y-3">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Call recordings
      </h2>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && (
        <p className="text-sm text-amber-700">Could not load recordings.</p>
      )}
      {!isLoading && !isError && recordings.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No recordings yet. Recordings appear when calls end with audio attached.
        </p>
      )}
      <ul className="space-y-2 max-h-48 overflow-y-auto">
        {recordings.map(r => (
          <li
            key={r.id}
            className="flex items-center gap-3 border rounded-md px-3 py-2 bg-gray-50/80"
          >
            {/* Play / Pause */}
            <button
              type="button"
              aria-label={playingId === r.id ? 'Pause recording' : 'Play recording'}
              onClick={() => void playRecording(r.id)}
              className="size-8 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-600 shrink-0"
            >
              {playingId === r.id ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>

            {/* Metadata */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {r.callSessionId || r.id}
              </p>
              <p className="text-xs text-muted-foreground">
                {r.direction ?? 'inbound'} · {formatDuration(r.durationSec ?? 0)} ·{' '}
                {new Date(r.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Download */}
            <button
              type="button"
              aria-label="Download recording"
              className="text-muted-foreground hover:text-gray-700 p-1 transition-colors"
              onClick={() => void downloadRecording(r.id, r.callSessionId)}
            >
              <Download className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
