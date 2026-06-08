'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

function formatDuration(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function WhatsAppVoiceMessage({
  src,
  isOutbound = false,
}: {
  src: string;
  isOutbound?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onMeta = () => setDuration(el.duration || 0);
    const onTime = () => setCurrent(el.currentTime || 0);
    const onEnd = () => setPlaying(false);

    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
    };
  }, [src]);

  async function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    try {
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const bars = 28;

  return (
    <div
      className={cn(
        'flex items-center gap-2 min-w-[200px] max-w-[280px] rounded-full px-2 py-1.5',
        isOutbound ? 'bg-emerald-600/10' : 'bg-emerald-50',
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
          isOutbound ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white',
        )}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ms-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-end gap-0.5 h-6">
          {Array.from({ length: bars }).map((_, i) => {
            const h = 30 + ((i * 17) % 70);
            const filled = (i / bars) * 100 <= progress;
            return (
              <span
                key={i}
                className={cn(
                  'w-0.5 rounded-full transition-colors',
                  filled ? 'bg-emerald-600' : 'bg-emerald-300',
                )}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
        <p className="text-[10px] text-emerald-800/80 mt-0.5 tabular-nums">
          {formatDuration(playing || current > 0 ? current : duration)}
        </p>
      </div>
    </div>
  );
}
