'use client';

import { useState } from 'react';
import { Download, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { fetchRecordingAudioBlob } from '@/lib/api/recording';
import { useCallRecordings } from '@/lib/hooks/useCallRecordings';
import { formatCallDuration, formatCallListWhen } from '@/lib/utils/phone';
import { cn } from '@/lib/utils/cn';

function formatWhen(iso: string): string {
  const { day, time } = formatCallListWhen(iso);
  return day && time ? `${day} · ${time}` : new Date(iso).toLocaleString();
}

interface Props {
  customerPhone?: string | null;
  transport?: 'pstn' | 'whatsapp' | 'webrtc';
  className?: string;
}

export function RecordingsPanel({ customerPhone, transport, className }: Props) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  const { data: recordings = [], isLoading, isError } = useCallRecordings({
    customerPhone,
    transport,
    enabled: !!customerPhone?.trim(),
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
    <div
      className={cn(
        'rounded-xl border border-gray-100 p-4 bg-white shadow-sm space-y-3 h-full flex flex-col min-h-[148px]',
        className,
      )}
    >
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Call recordings
      </h2>
      {!customerPhone?.trim() ? (
        <p className="text-sm text-muted-foreground">
          Select a call from recent list to view recordings.
        </p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-amber-700">Could not load recordings.</p>
      ) : recordings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No recordings for this caller yet.
        </p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {recordings.map(r => (
            <li
              key={`${r.recordingId}-${r.callSessionId}`}
              className="flex items-center gap-3 border rounded-md px-3 py-2 bg-gray-50/80"
            >
              <button
                type="button"
                aria-label={playingId === r.recordingId ? 'Pause recording' : 'Play recording'}
                onClick={() => void playRecording(r.recordingId)}
                className="size-8 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-600 shrink-0"
              >
                {playingId === r.recordingId ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate capitalize">
                  {r.direction ?? 'inbound'} · {formatCallDuration(r.duration)}
                </p>
                <p className="text-xs text-muted-foreground">{formatWhen(r.startedAt)}</p>
              </div>

              <button
                type="button"
                aria-label="Download recording"
                className="text-muted-foreground hover:text-gray-700 p-1 transition-colors"
                onClick={() => void downloadRecording(r.recordingId, r.callSessionId)}
              >
                <Download className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
