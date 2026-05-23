'use client';

import { Play } from 'lucide-react';
import { useState } from 'react';

const TIMELINE = [
  { dot: 'bg-[#e24b4a]', title: 'Incoming ring', sub: '10:24:01 AM · WhatsApp' },
  { dot: 'bg-[#3b6d11]', title: 'Answered by agent', sub: '10:24:09 AM · Sara K.' },
  { dot: 'bg-[#0B5FFF]', title: 'In progress', sub: '03:47 elapsed' },
];

const RECORDINGS = [
  { title: 'Yesterday · 2:31', duration: '2:31', fill: '40%' },
  { title: 'May 18 · 4:12', duration: '4:12', fill: '25%' },
];

export function CallTimelinePanel() {
  const [tab, setTab] = useState<'info' | 'calls' | 'ai'>('calls');

  return (
    <aside className="w-[220px] shrink-0 border-s border-gray-100 bg-white flex flex-col">
      <div className="flex border-b border-gray-100">
        {(['info', 'calls', 'ai'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[11px] font-medium capitalize border-b-2 -mb-px ${
              tab === t ? 'text-[#0B5FFF] border-[#0B5FFF]' : 'text-gray-500 border-transparent'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-2.5 text-sm">
        {tab === 'info' && (
          <p className="text-xs text-gray-500 text-center py-6">Contact details appear here.</p>
        )}
        {tab === 'ai' && (
          <p className="text-xs text-gray-500 text-center py-6">Agent assist suggestions appear here.</p>
        )}
        {tab === 'calls' && (
          <>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">
              Call activity
            </p>
            {TIMELINE.map(row => (
              <div key={row.title} className="flex gap-2 mb-3">
                <span className={`size-2 rounded-full mt-1 shrink-0 ${row.dot}`} />
                <div>
                  <p className="text-[11px] font-medium text-gray-900">{row.title}</p>
                  <p className="text-[11px] text-gray-500">{row.sub}</p>
                </div>
              </div>
            ))}
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mt-3 mb-2">
              Previous calls
            </p>
            {RECORDINGS.map(rec => (
              <div
                key={rec.title}
                className="flex items-center gap-2 p-2 mb-1.5 rounded-lg border border-gray-100"
              >
                <span className="size-[26px] rounded-full bg-[#e6f1fb] text-[#185fa5] flex items-center justify-center shrink-0">
                  <Play size={12} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-900">{rec.title}</p>
                  <div className="h-[3px] mt-1 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full bg-[#0B5FFF] rounded-full" style={{ width: rec.fill }} />
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 tabular-nums">{rec.duration}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
