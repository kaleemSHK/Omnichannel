'use client';

import { Bot, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const SUGGESTIONS = [
  'Acknowledge wait time and confirm ticket reference.',
  'Offer callback if resolution exceeds SLA.',
  'Summarize last complaint from CRM before proposing fix.',
];

export function AiAssistStrip({
  sentiment = 'neutral',
  className,
}: {
  sentiment?: 'positive' | 'neutral' | 'negative';
  className?: string;
}) {
  const sentimentColor =
    sentiment === 'positive'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : sentiment === 'negative'
        ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
        : 'text-sky-400 bg-sky-500/10 border-sky-500/20';

  return (
    <div className={cn('cw-glass rounded-xl p-4 space-y-3 animate-cw-slide-in', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sky-300">
          <Sparkles size={16} aria-hidden />
          <span className="text-sm font-semibold text-white">AI live assist</span>
        </div>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border capitalize', sentimentColor)}>
          {sentiment} sentiment
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        Real-time transcription and auto-summaries connect when the AI sidecar stream is enabled on
        your tenant.
      </p>
      <ul className="space-y-2">
        {SUGGESTIONS.map((s, i) => (
          <li
            key={i}
            className="flex gap-2 text-xs text-slate-300 bg-white/5 rounded-lg px-3 py-2 border border-white/5 hover:border-sky-500/30 transition-colors cursor-default"
          >
            <Bot size={14} className="shrink-0 text-sky-400 mt-0.5" aria-hidden />
            {s}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <TrendingUp size={12} aria-hidden />
        Suggested disposition: Follow-up · Priority medium
      </div>
    </div>
  );
}
