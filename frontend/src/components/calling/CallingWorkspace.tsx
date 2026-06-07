'use client';

import { useEffect, useMemo, useState, type ElementType } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Headphones,
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneForwarded,
  PhoneIncoming,
  PhoneOff,
  Play,
  Radio,
} from 'lucide-react';
import { toast } from 'sonner';
import { AgentStateSelector } from '@/components/calling/AgentStateSelector';
import { CdrDetailPanel, SessionDetailPanel } from '@/components/calling/CallDetailPanel';
import { CallSessionItem, CdrListItem } from '@/components/calling/CallListItem';
import { CallTimer } from '@/components/calling/CallTimer';
import { CallNotesModal } from '@/components/calling/CallNotesModal';
import { DialPad } from '@/components/calling/DialPad';
import { RecordingsPanel } from '@/components/calling/RecordingsPanel';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/input';
import { answerCall, createSession, holdCall } from '@/lib/api/calls';
import { unlockSipAudio } from '@/lib/telephony/sip-audio';
import {
  useActiveSessions,
  useCDR,
  useDeclineCall,
} from '@/lib/hooks/useCalls';
import { useQueryClient } from '@tanstack/react-query';
import { useQueues } from '@/lib/hooks/useQueues';
import { useAuthStore } from '@/lib/store/auth';
import { useCallsStore } from '@/lib/store/calls';
import { can } from '@/lib/rbac';
import { useAgents } from '@/lib/hooks/useAgentState';
import { resolveCallerName, resolveCdrCallerName, transportLabel } from '@/lib/utils/calling';
import { CALL_HISTORY_INVALIDATE } from '@/lib/calling/call-history-events';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { cn } from '@/lib/utils/cn';
import type { CDRRecord } from '@/types';

function CtrlBtn({
  label,
  icon: Icon,
  onClick,
  active,
  destructive,
  className,
}: {
  label: string;
  icon: ElementType;
  onClick?: () => void;
  active?: boolean;
  destructive?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
        active && 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary',
        destructive && 'text-red-700 border-red-200 bg-red-50 hover:bg-red-100',
        !active && !destructive && 'hover:bg-muted',
        className,
      )}
    >
      <Icon size={14} aria-hidden />
      {label}
    </button>
  );
}

export function CallingWorkspace() {
  const searchParams = useSearchParams();
  const dialFromUrl = searchParams.get('dial')?.trim() ?? '';
  const [transport, setTransport] = useState<'pstn' | 'whatsapp' | 'webrtc'>('pstn');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferMode, setTransferMode] = useState<'blind' | 'attended'>('blind');
  const [cdrPage, setCdrPage] = useState(1);
  const [cdrRows, setCdrRows] = useState<CDRRecord[]>([]);

  const { user } = useAuthStore();
  const qc = useQueryClient();
  const activeCall = useCallsStore(s => s.activeCall);
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const muted = useCallsStore(s => s.muted);
  const held = useCallsStore(s => s.held);
  const incoming = useCallsStore(s => s.incomingCalls);
  const contactCache = useCallsStore(s => s.contactCache);
  const sipRegistered = useCallsStore(s => s.sipRegistered);
  const sipError = useCallsStore(s => s.sipError);

  const { data: sessions = [] } = useActiveSessions(transport);
  const { data: cdrBatch = [], isFetching: cdrFetching, refetch: refetchCdr } = useCDR({
    limit: 20,
    page: cdrPage,
    transport,
  });
  const { data: queues = [] } = useQueues();
  const { data: routingAgents = [] } = useAgents();
  const decline = useDeclineCall();
  const makeCall = useCallsStore(s => s.makeCall);
  const setPendingDialNumber = useCallsStore(s => s.setPendingDialNumber);
  const sipControls = useCallsStore(s => s.sipControls);

  useEffect(() => {
    if (!dialFromUrl) return;
    setPendingDialNumber(dialFromUrl.replace(/[^\d+]/g, ''));
  }, [dialFromUrl, setPendingDialNumber]);

  const filtered = sessions;
  const filteredCdr = cdrRows;
  const activeList = filtered.filter(
    s => s.status === 'connected' || s.status === 'ringing',
  );
  const selectedSession =
    filtered.find(s => s.id === selectedId) ??
    sessions.find(s => s.id === selectedId) ??
    null;
  const selectedCdr =
    filteredCdr.find(r => r.callSessionId === selectedId || r.id === selectedId) ?? null;

  const selectedCustomerPhone =
    activeCall?.customerPhone?.trim() ||
    selectedSession?.customerPhone?.trim() ||
    selectedCdr?.customerPhone?.trim() ||
    null;

  const incomingRing = incoming.find(c => c.transport === transport) ?? null;
  const isSupervisor = can(user?.role, 'supervisorListen');
  const queueDisplay = queues.length > 0 ? queues : [];
  const showEmptyCenter =
    !activeCall && !incomingRing && !selectedSession && !selectedCdr;
  // Show "Sample" badge only when demo data is active
  const showSampleBadge = isDemoDataEnabled() && queueDisplay.length > 0;
  const showingCallerDetail =
    (selectedSession != null && (!activeCall || activeCall.id !== selectedSession.id)) ||
    (selectedCdr != null &&
      (!selectedSession || selectedCdr.callSessionId !== selectedSession.id));
  const insightCard =
    'rounded-xl border border-gray-100 p-4 bg-white shadow-sm h-full flex flex-col min-h-[148px]';

  useEffect(() => {
    setCdrPage(1);
    setCdrRows([]);
    setSelectedId(null);
  }, [transport]);

  useEffect(() => {
    const onInvalidate = () => {
      void refetchCdr();
      void qc.invalidateQueries({ queryKey: ['activeSessions'] });
    };
    window.addEventListener(CALL_HISTORY_INVALIDATE, onInvalidate);
    return () => window.removeEventListener(CALL_HISTORY_INVALIDATE, onInvalidate);
  }, [refetchCdr, qc]);

  useEffect(() => {
    if (!selectedId) {
      const pick = activeList[0]?.id ?? filteredCdr[0]?.callSessionId;
      if (pick) setSelectedId(pick);
      return;
    }
    const stillVisible =
      activeList.some(s => s.id === selectedId) ||
      filteredCdr.some(r => r.callSessionId === selectedId || r.id === selectedId);
    if (!stillVisible) setSelectedId(activeList[0]?.id ?? filteredCdr[0]?.callSessionId ?? null);
  }, [transport, activeList, filteredCdr, selectedId]);

  useEffect(() => {
    if (cdrPage === 1) {
      setCdrRows(
        [...cdrBatch].sort(
          (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
        ),
      );
      return;
    }
    setCdrRows(prev => {
      const ids = new Set(prev.map(r => r.id));
      const merged = [...prev, ...cdrBatch.filter(r => !ids.has(r.id))];
      return merged.sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );
    });
  }, [cdrBatch, cdrPage]);

  // Keyboard shortcuts — Space/Enter = answer, Esc = decline
  useEffect(() => {
    if (!incomingRing) return;
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        void unlockSipAudio();
        sipControls?.answerCall();
        useCallsStore.getState().removeIncomingCall(incomingRing.id);
        setActiveCall(incomingRing);
        void answerCall(incomingRing.id, incomingRing.roomId)
          .then(c => setActiveCall(c))
          .catch(() => undefined);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        decline.mutate(incomingRing.id);
        useCallsStore.getState().removeIncomingCall(incomingRing.id);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [incomingRing, sipControls, decline, setActiveCall]);

  // Keyboard shortcut — M = mute during active call
  useEffect(() => {
    if (!activeCall) return;
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'm' || e.key === 'M') sipControls?.toggleMute();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeCall, sipControls]);

  const handleHangup = () => {
    sipControls?.hangup();
  };

  const handleHold = () => {
    sipControls?.toggleHold();
    if (activeCall && !isDemoDataEnabled()) {
      void holdCall(activeCall.id, !held).catch(() => undefined);
    }
  };

  const handleTransfer = () => {
    const t = transferTarget.trim();
    if (!t) return;
    if (transferMode === 'blind') {
      sipControls?.blindTransfer(t);
      toast.success(`Blind transfer to ${t} initiated`);
    } else {
      // Attended: put on hold, notify agent to dial target manually
      sipControls?.toggleHold();
      toast.info(`Call held. Dial ${t} to consult, then complete transfer.`);
    }
    setTransferOpen(false);
    setTransferTarget('');
  };

  function cdrLabel(record: CDRRecord): string {
    return resolveCdrCallerName(record, contactCache);
  }

  return (
    <div className="flex h-full min-h-0 bg-slate-50">
      {/* ── Left sidebar: active / recent calls ─────────────────────── */}
      <aside className="w-56 shrink-0 border-e border-gray-200 bg-white flex flex-col min-h-0">
        {/* SIP status banner */}
        {!isDemoDataEnabled() && (
          <div
            className={cn(
              'px-3 py-2 text-[11px] leading-snug border-b flex items-start gap-2',
              sipRegistered
                ? 'bg-green-50 text-green-800 border-green-100'
                : 'bg-amber-50 text-amber-900 border-amber-100',
            )}
          >
            <Headphones
              size={14}
              className={cn('shrink-0 mt-0.5', sipRegistered ? 'text-green-600' : 'text-amber-600')}
              aria-hidden
            />
            <span>
              {sipRegistered ? (
                'Softphone connected'
              ) : (
                <>
                  <span className="font-medium">
                    {sipError ? 'Softphone offline' : 'Connecting softphone…'}
                  </span>
                  <span className="block text-[10px] text-amber-800/90 mt-0.5">
                    {sipError ?? 'Waiting for SIP registration'}
                  </span>
                </>
              )}
            </span>
          </div>
        )}

        {/* PSTN / WhatsApp / WebRTC tabs */}
        <div className="flex border-b border-gray-100">
          {(
            [
              { key: 'pstn' as const, label: 'PSTN' },
              { key: 'whatsapp' as const, label: 'WhatsApp' },
              { key: 'webrtc' as const, label: 'WebRTC' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={transport === key}
              onClick={() => {
                setTransport(key);
              }}
              className={cn(
                'flex-1 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
                transport === key
                  ? 'text-brand-primary border-brand-primary'
                  : 'text-gray-500 border-transparent hover:text-gray-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          Active
        </p>
        <div className="flex-1 overflow-y-auto min-h-0">
          {activeList.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No active calls</p>
          ) : (
            activeList.map(s => (
              <CallSessionItem
                key={s.id}
                session={s}
                active={selectedId === s.id}
                onSelect={() => setSelectedId(s.id)}
              />
            ))
          )}

          <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Recent
          </p>
          {filteredCdr.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No recent calls</p>
          ) : (
            filteredCdr.map(r => (
              <CdrListItem
                key={r.id}
                record={r}
                label={cdrLabel(r)}
                active={selectedId === r.callSessionId || selectedId === r.id}
                onSelect={() => setSelectedId(r.callSessionId)}
              />
            ))
          )}
          {cdrBatch.length >= 20 && (
            <button
              type="button"
              onClick={() => setCdrPage(p => p + 1)}
              disabled={cdrFetching}
              className="w-full text-xs text-center py-2 text-muted-foreground hover:text-foreground border-t"
            >
              {cdrFetching ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      </aside>

      {/* ── Main panel ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {activeCall
                ? resolveCallerName(activeCall, contactCache)
                : selectedSession
                  ? resolveCallerName(selectedSession, contactCache)
                  : selectedCdr
                    ? cdrLabel(selectedCdr)
                    : 'Call workspace'}
            </p>
            <p className="text-xs text-gray-500">
              {activeCall
                ? `${transportLabel(activeCall.transport)} · ${activeCall.customerPhone || '—'}`
                : selectedSession
                  ? `${transportLabel(selectedSession.transport)} · ${selectedSession.customerPhone || '—'}`
                  : selectedCdr
                    ? `${transportLabel(selectedCdr.transport)} · ${selectedCdr.customerPhone || '—'}`
                    : 'Select a call or dial from the keypad'}
            </p>
          </div>
          <AgentStateSelector />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
          {/* Empty state */}
          {showEmptyCenter && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center rounded-xl border border-dashed border-gray-200 bg-slate-50/80">
              <div className="w-14 h-14 rounded-full bg-blue-50 text-brand-primary flex items-center justify-center mb-4">
                <PhoneIncoming size={28} aria-hidden />
              </div>
              <h2 className="text-base font-semibold text-gray-900">Ready to take calls</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Pick a conversation from <span className="font-medium">Active</span> or{' '}
                <span className="font-medium">Recent</span>, or enter a number in the dial pad and
                press Call.
              </p>
              {!sipRegistered && (transport === 'pstn' || transport === 'webrtc') && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-4 max-w-sm">
                  PSTN dial-out requires a registered softphone. Try the WhatsApp tab for outbound
                  without SIP.
                </p>
              )}
            </div>
          )}

          {/* Incoming call card (with pulse animation) */}
          {incomingRing && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200 animate-pulse-once">
              <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-sm font-semibold">
                  {resolveCallerName(incomingRing, contactCache).slice(0, 2).toUpperCase()}
                </div>
                {/* Pulse rings */}
                <span className="absolute inset-0 rounded-full bg-green-400 opacity-30 animate-ping" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  {resolveCallerName(incomingRing, contactCache)}
                </p>
                <p className="text-xs text-green-700">{incomingRing.customerPhone}</p>
                <p className="text-[10px] text-green-600/80 mt-0.5">
                  Press <kbd className="font-mono bg-green-100 px-1 rounded">Space</kbd> to answer ·{' '}
                  <kbd className="font-mono bg-green-100 px-1 rounded">Esc</kbd> to decline
                </p>
              </div>
              <button
                type="button"
                aria-label="Answer call"
                className="w-11 h-11 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shadow-sm transition-colors"
                onClick={() => {
                  void unlockSipAudio();
                  sipControls?.answerCall();
                  useCallsStore.getState().removeIncomingCall(incomingRing.id);
                  setActiveCall(incomingRing);
                  void answerCall(incomingRing.id, incomingRing.roomId)
                    .then(c => setActiveCall(c))
                    .catch(() => undefined);
                }}
              >
                <Phone size={18} />
              </button>
              <button
                type="button"
                aria-label="Decline call"
                className="w-11 h-11 rounded-full bg-red-100 hover:bg-red-200 text-red-700 flex items-center justify-center transition-colors"
                onClick={() => {
                  decline.mutate(incomingRing.id);
                  useCallsStore.getState().removeIncomingCall(incomingRing.id);
                }}
              >
                <PhoneOff size={18} />
              </button>
            </div>
          )}

          {/* Selected caller overview — horizontal card grid */}
          {showingCallerDetail && (
            <div className="space-y-3">
              {selectedSession && (!activeCall || activeCall.id !== selectedSession.id) && (
                <SessionDetailPanel session={selectedSession} />
              )}
              {selectedCdr &&
                (!selectedSession || selectedCdr.callSessionId !== selectedSession.id) && (
                  <CdrDetailPanel record={selectedCdr} agents={routingAgents} />
                )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
                <div className={insightCard}>
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Queue stats
                    </p>
                    {showSampleBadge && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        Sample
                      </span>
                    )}
                  </div>
                  {queueDisplay.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No queues configured</p>
                  ) : (
                    <ul className="space-y-1.5 flex-1 min-h-0 overflow-y-auto">
                      {queueDisplay.map(q => (
                        <li
                          key={q.id}
                          className="flex justify-between gap-2 text-xs py-1.5 border-b border-gray-50 last:border-0"
                        >
                          <span className="font-medium truncate">{q.name}</span>
                          <span className="text-gray-500 shrink-0 tabular-nums">
                            {q.stats?.waiting ?? 0} · {q.stats?.avgWaitSec ?? 0}s
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={insightCard}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 shrink-0">
                    Today
                  </p>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">{filteredCdr.length}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{transportLabel(transport)} calls</p>
                  <p className="text-xs text-red-600 mt-1.5 font-medium">
                    {filteredCdr.filter(r => r.outcome === 'missed').length} missed
                  </p>
                </div>

                <RecordingsPanel
                  customerPhone={selectedCustomerPhone}
                  transport={transport}
                  className={cn(insightCard, 'mt-0')}
                />
              </div>
            </div>
          )}

          {/* Active call controls */}
          {activeCall && (
            <div className="rounded-xl border p-4 space-y-4 bg-white shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-brand-primary flex items-center justify-center text-lg font-semibold shrink-0">
                  {resolveCallerName(activeCall, contactCache).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold">
                    {resolveCallerName(activeCall, contactCache)}
                  </p>
                  <p className="text-sm text-gray-500">{activeCall.customerPhone}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium',
                        activeCall.status === 'connected'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800',
                      )}
                    >
                      {activeCall.status === 'connected' ? 'Connected' : 'Ringing…'}
                    </span>
                    {held && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">
                        On Hold
                      </span>
                    )}
                    {muted && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                        Muted
                      </span>
                    )}
                  </div>
                </div>
                {activeCall.status === 'connected' && (
                  <CallTimer
                    startTime={activeCall.connectedAt ?? activeCall.startedAt}
                    className="text-xl font-semibold text-brand-primary tabular-nums shrink-0"
                  />
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <CtrlBtn
                  label={muted ? 'Unmute' : 'Mute'}
                  icon={muted ? MicOff : Mic}
                  active={muted}
                  onClick={() => sipControls?.toggleMute()}
                />
                <CtrlBtn
                  label={held ? 'Resume' : 'Hold'}
                  icon={held ? Play : Pause}
                  active={held}
                  onClick={handleHold}
                />
                <CtrlBtn
                  label="Transfer"
                  icon={PhoneForwarded}
                  onClick={() => setTransferOpen(true)}
                />
                <CtrlBtn
                  label="Record"
                  icon={Radio}
                  onClick={() => toast.info('Recording is managed server-side automatically')}
                />
                <CtrlBtn
                  label="End call"
                  icon={PhoneOff}
                  destructive
                  onClick={handleHangup}
                  className="ms-auto"
                />
              </div>
            </div>
          )}

          {!showingCallerDetail && !showEmptyCenter && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
              <div className={insightCard}>
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Queue stats
                  </p>
                  {showSampleBadge && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      Sample
                    </span>
                  )}
                </div>
                {queueDisplay.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No queues configured</p>
                ) : (
                  <ul className="space-y-1.5">
                    {queueDisplay.map(q => (
                      <li
                        key={q.id}
                        className="flex justify-between gap-2 text-xs py-1.5 border-b border-gray-50 last:border-0"
                      >
                        <span className="font-medium truncate">{q.name}</span>
                        <span className="text-gray-500 shrink-0 tabular-nums">
                          {q.stats?.waiting ?? 0} · {q.stats?.avgWaitSec ?? 0}s
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className={insightCard}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Today
                </p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{filteredCdr.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">{transportLabel(transport)} calls</p>
                <p className="text-xs text-red-600 mt-1.5 font-medium">
                  {filteredCdr.filter(r => r.outcome === 'missed').length} missed
                </p>
              </div>

              <RecordingsPanel
                customerPhone={selectedCustomerPhone}
                transport={transport}
                className={cn(insightCard, 'mt-0')}
              />
            </div>
          )}

          {/* Supervisor controls */}
          {isSupervisor && (selectedSession || activeCall) && (
            <div className="rounded-xl border p-3 bg-white">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Supervisor
              </p>
              <div className="flex gap-2">
                {(['Listen', 'Whisper', 'Barge'] as const).map(label => (
                  <button
                    key={label}
                    type="button"
                    aria-label={`${label} into call`}
                    className="px-3 py-1.5 text-xs border rounded-lg hover:bg-muted transition-colors"
                    onClick={() =>
                      toast.info(`${label} via Asterisk AMI — configure in infra/asterisk`)
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right sidebar: dial pad ──────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-s border-gray-200 bg-white flex flex-col">
        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0">
          Dial pad
        </p>
        <DialPad
          transport={transport}
          disabled={!user}
          initialNumber={dialFromUrl}
          onCall={async (number, t) => {
            if (t === 'pstn' || t === 'webrtc') {
              if (!makeCall || !sipRegistered) {
                toast.error('Softphone not connected — wait for "Softphone connected".');
                return;
              }
              makeCall(number);
              return;
            }
            if (!user) return;
            if (isDemoDataEnabled()) {
              setActiveCall({
                id: `wa-${Date.now()}`,
                tenantId: user.tenantId,
                roomId: `wa-${Date.now()}`,
                channel: 'whatsapp',
                agentLabel: user.name,
                customerPhone: number,
                status: 'ringing',
                transport: 'whatsapp',
                direction: 'outbound',
                startedAt: new Date().toISOString(),
              });
              return;
            }
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

      {/* ── Transfer dialog ──────────────────────────────────────────── */}
      <Dialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Transfer call"
        className="sm:max-w-sm"
      >
        {/* Blind / Attended tabs */}
        <div className="flex border border-gray-200 rounded-md overflow-hidden text-xs mb-3">
          {(['blind', 'attended'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setTransferMode(mode)}
              className={cn(
                'flex-1 py-1.5 capitalize font-medium transition-colors',
                transferMode === mode
                  ? 'bg-blue-50 text-brand-primary'
                  : 'text-gray-500 hover:bg-gray-50',
              )}
            >
              {mode === 'blind' ? 'Blind transfer' : 'Warm transfer'}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          {transferMode === 'blind'
            ? 'The call is immediately transferred to the destination.'
            : 'The call is held while you consult the destination first.'}
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Extension or +968…"
            value={transferTarget}
            onChange={e => setTransferTarget(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTransfer()}
            autoFocus
          />
          <Button
            onClick={handleTransfer}
            disabled={!transferTarget.trim()}
            className="bg-brand-primary hover:bg-brand-primary/90 shrink-0"
          >
            {transferMode === 'blind' ? 'Transfer' : 'Hold & Consult'}
          </Button>
        </div>
      </Dialog>

      {/* ── After-Call Work notes modal ──────────────────────────────── */}
      <CallNotesModal />
    </div>
  );
}
