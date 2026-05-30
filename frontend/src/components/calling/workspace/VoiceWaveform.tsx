'use client';

import { cn } from '@/lib/utils/cn';

const BARS = 24;

export function VoiceWaveform({
  active = true,
  className,
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn('flex items-end justify-center gap-[3px] h-12', className)}
      aria-hidden
    >
      {Array.from({ length: BARS }, (_, i) => (
        <span
          key={i}
          className={cn(
            'w-1 rounded-full bg-gradient-to-t from-sky-500/40 to-cyan-300',
            active && 'animate-cw-wave',
          )}
          style={{
            height: `${28 + (i % 5) * 8}%`,
            animationDelay: active ? `${(i % 8) * 0.07}s` : undefined,
            animationPlayState: active ? 'running' : 'paused',
            opacity: active ? 1 : 0.25,
          }}
        />
      ))}
    </div>
  );
}
