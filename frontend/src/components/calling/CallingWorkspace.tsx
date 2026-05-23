'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneForwarded,
  PhoneOff,
  Radio,
} from 'lucide-react';
import { AgentStateSelector } from '@/components/calling/AgentStateSelector';
import { CallSessionItem, CdrListItem } from '@/components/calling/CallListItem';
import { DialPad } from '@/components/calling/DialPad';
import { demoCallerName } from '@/lib/demo/callsFixture';
import { DEMO_QUEUES } from '@/lib/demo/callingFixture';
import { useActiveSessions, useAnswerCall, useCDR, declineCall } from '@/lib/hooks/useCalls';
import { useJsSip } from '@/lib/hooks/useJsSip';
import { useAuthStore } from '@/lib/store/auth';
import { can } from '@/lib/rbac';
import { useCallsStore } from '@/lib/store/calls';
import { createSession } from '@/lib/api/calls';
import { cn } from '@/lib/utils/cn';

function useElapsed(connectedAt?: string, startedAt?: string, running?: boolean) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = new Date(connectedAt ?? startedAt ?? Date.now()).getTime();
    const tick = () => setSec(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [connectedAt, startedAt, running]);
  const mm = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function CallingWorkspace() {
  const [transport, setTransport] = useState<'pstn' | 'whatsapp'>('pstn');
  const [selectedId, setSelectedId] = useState<string | null>('demo-live-1');
  const [muted, setMuted] = useState(false);
  const { user } = useAuthStore();
  const activeCall = useCallsStore(s => s.activeCall);
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const incoming = useCallsStore(s => s.incomingCalls);
  const { data: sessions = [] } = useActiveSessions();
  const { data: cdr = [] } = useCDR({ limit: 20 });
  const answer = useAnswerCall();
  const { makeCall, hangup, mute, unmute, hold } = useJsSip();

  const filtered = sessions.filter(s => s.transport === transport);
  const selected =
    filtered.find(s => s.id === selectedId) ??
    sessions.find(s => s.id === selectedId) ??
    activeCall;

  const elapsed = useElapsed(
    selected?.connectedAt,
    selected?.startedAt,
    selected?.status === 'connected',
  );

  const isSupervisor = can(user?.role, 'supervisorListen');

  const incomingRing = incoming[0] ?? filtered.find(s => s.status === 'ringing');

  const cdrLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) map.set(s.id, demoCallerName(s));
    return map;
  }, [sessions]);

  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)] bg-surface-tertiary">
      <aside className="w-[220px] shrink-0 border-e border-gray-200 bg-white flex flex-col">
        <div className="flex border-b border-gray-100">
          {(['pstn', 'whatsapp'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTransport(t)}
              className={cn(
                'flex-1 py-2 text-xs font-medium capitalize border-b-2 -mb-px',
                transport === t ? 'text-[#0B5FFF] border-[#0B5FFF]' : 'text-gray-500 border-transparent',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="px-3 pt-2 text-[10px] font-medium text-gray-500 uppercase">Active</p>
        <div className="flex-1 overflow-y-auto">
          {filtered
            .filter(s => s.status === 'connected' || s.status === 'ringing')
            .map(s => (
              <CallSessionItem
                key={s.id}
                session={s}
                active={selectedId === s.id}
                elapsed={s.status === 'connected' ? elapsed : undefined}
                onSelect={() => setSelectedId(s.id)}
              />
            ))}
          <p className="px-3 pt-3 text-[10px] font-medium text-gray-500 uppercase">Recent</p>
          {cdr.map(r => (
            <CdrListItem
              key={r.id}
              record={r}
              label={cdrLabels.get(r.callSessionId) ?? r.callSessionId}
              active={selectedId === r.callSessionId}
              onSelect={() => setSelectedId(r.callSessionId)}
            />
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {selected ? demoCallerName(selected) : 'No call selected'}
            </p>
            <p className="text-xs text-gray-500">{DEMO_QUEUES[0]?.name ?? 'Support'} queue</p>
          </div>
          <AgentStateSelector />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {incomingRing && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="size-10 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-sm font-medium">
                {demoCallerName(incomingRing).slice(0, 2)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{demoCallerName(incomingRing)}</p>
                <p className="text-xs text-gray-600">{incomingRing.customerPhone}</p>
              </div>
              <button
                type="button"
                className="size-10 rounded-full bg-green-600 text-white flex items-center justify-center"
                onClick={() =>
                  answer.mutate(incomingRing.id, { onSuccess: c => setActiveCall(c) })
                }
              >
                <Phone size={18} />
              </button>
              <button
                type="button"
                className="size-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center"
                onClick={() => {
                  void declineCall(incomingRing.id);
                  useCallsStore.getState().removeIncomingCall(incomingRing.id);
                }}
              >
                <PhoneOff size={18} />
              </button>
            </div>
          )}

          {activeCall && (
            <div className="bn-card p-4">
              <div className="flex items-start gap-3">
                <div className="size-12 rounded-full bg-[#EEF3FF] text-[#0B5FFF] flex items-center justify-center text-lg font-medium">
                  {demoCallerName(activeCall).slice(0, 2)}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-medium">{demoCallerName(activeCall)}</p>
                  <p className="text-sm text-gray-500">{activeCall.customerPhone}</p>
                  <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800">
                    Gold SLA
                  </span>
                </div>
                <p className="text-2xl font-medium text-[#0B5FFF] tabular-nums">{elapsed}</p>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  type="button"
                  className={cn('call-ctrl', muted && 'bg-blue-50 border-blue-200')}
                  onClick={() => {
                    if (muted) unmute();
                    else mute();
                    setMuted(m => !m);
                  }}
                >
                  {muted ? <MicOff size={16} /> : <Mic size={16} />} Mute
                </button>
                <button type="button" className="call-ctrl" onClick={() => hold()}>
                  <Pause size={16} /> Hold
                </button>
                <button type="button" className="call-ctrl">
                  <PhoneForwarded size={16} /> Transfer
                </button>
                <button type="button" className="call-ctrl">
                  <Radio size={16} /> Record
                </button>
                <button
                  type="button"
                  className="call-ctrl text-red-700 border-red-200 bg-red-50 ms-auto"
                  onClick={() => {
                    hangup();
                    setActiveCall(null);
                  }}
                >
                  <PhoneOff size={16} /> End
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bn-card p-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Queue stats</p>
              {DEMO_QUEUES.map(q => (
                <div key={q.id} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                  <span>{q.name}</span>
                  <span className="text-gray-500">
                    {q.stats?.waiting ?? 0} waiting · {q.stats?.avgWaitSec ?? 0}s avg
                  </span>
                </div>
              ))}
            </div>
            <div className="bn-card p-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Today</p>
              <p className="text-2xl font-medium">{cdr.length}</p>
              <p className="text-xs text-gray-500">completed / missed calls</p>
            </div>
          </div>

          {isSupervisor && (
            <div className="bn-card p-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Supervisor</p>
              <div className="flex gap-2">
                {['Listen', 'Whisper', 'Barge'].map(label => (
                  <button key={label} type="button" className="call-ctrl text-xs">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="w-[240px] shrink-0 border-s border-gray-200 bg-white">
        <DialPad
          transport={transport}
          disabled={!user}
          onCall={async (number, t) => {
            if (t === 'pstn') {
              makeCall(number);
              return;
            }
            if (!user) return;
            const session = await createSession({
              roomId: `wa-${Date.now()}`,
              chatwootAccountId: user.chatwootAccountId,
              agentLabel: user.name,
              customerPhone: number,
              transport: 'whatsapp',
              direction: 'outbound',
            });
            setActiveCall(session);
          }}
        />
      </aside>
    </div>
  );
}
