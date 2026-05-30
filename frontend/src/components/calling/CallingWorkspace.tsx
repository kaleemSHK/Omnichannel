'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Headphones, PhoneIncoming } from 'lucide-react';
import { toast } from 'sonner';
import { AgentStateSelector } from '@/components/calling/AgentStateSelector';
import { CallSessionItem, CdrListItem } from '@/components/calling/CallListItem';
import { CallNotesModal } from '@/components/calling/CallNotesModal';
import { DialPad } from '@/components/calling/DialPad';
import { RecordingsPanel } from '@/components/calling/RecordingsPanel';
import { ActiveCallStage } from '@/components/calling/workspace/ActiveCallStage';
import { CustomerContextPanel } from '@/components/calling/workspace/CustomerContextPanel';
import { IncomingCallHero } from '@/components/calling/workspace/IncomingCallHero';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/input';
import { createSession, endCall, holdCall } from '@/lib/api/calls';
import {
  useActiveSessions,
  useAnswerCall,
  useCDR,
  useDeclineCall,
} from '@/lib/hooks/useCalls';
import { useQueues } from '@/lib/hooks/useQueues';
import { useAuthStore } from '@/lib/store/auth';
import { useCallsStore } from '@/lib/store/calls';
import { can } from '@/lib/rbac';
import { resolveCallerName } from '@/lib/utils/calling';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { demoCallerName } from '@/lib/demo/callingFixture';
import { cn } from '@/lib/utils/cn';
import type { CDRRecord } from '@/types';

export function CallingWorkspace() {
  const [transport, setTransport] = useState<'pstn' | 'whatsapp'>('pstn');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferMode, setTransferMode] = useState<'blind' | 'attended'>('blind');
  const [cdrPage, setCdrPage] = useState(1);
  const [cdrRows, setCdrRows] = useState<CDRRecord[]>([]);
  const [contextCollapsed, setContextCollapsed] = useState(false);

  const { user } = useAuthStore();
  const activeCall = useCallsStore(s => s.activeCall);
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const muted = useCallsStore(s => s.muted);
  const held = useCallsStore(s => s.held);
  const incoming = useCallsStore(s => s.incomingCalls);
  const contactCache = useCallsStore(s => s.contactCache);
  const sipRegistered = useCallsStore(s => s.sipRegistered);
  const sipError = useCallsStore(s => s.sipError);

  const { data: sessions = [] } = useActiveSessions();
  const { data: cdrBatch = [], isFetching: cdrFetching } = useCDR({ limit: 20, page: cdrPage });
  const { data: queues = [] } = useQueues();
  const answer = useAnswerCall();
  const decline = useDeclineCall();
  const makeCall = useCallsStore(s => s.makeCall);
  const sipControls = useCallsStore(s => s.sipControls);

  const filtered = sessions.filter(s => s.transport === transport);
  const activeList = filtered.filter(
    s => s.status === 'connected' || s.status === 'ringing',
  );
  const selected =
    filtered.find(s => s.id === selectedId) ??
    sessions.find(s => s.id === selectedId) ??
    activeCall;

  const incomingRing = incoming[0];
  const isSupervisor = can(user?.role, 'supervisorListen');
  const queueDisplay = queues;
  const showEmptyCenter = !activeCall && !incomingRing && !selected;

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayRows = useMemo(
    () => cdrRows.filter(r => new Date(r.startedAt) >= todayStart),
    [cdrRows, todayStart],
  );

  useEffect(() => {
    if (!selectedId && filtered.length > 0) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered.length, selectedId]);

  useEffect(() => {
    if (cdrPage === 1) {
      setCdrRows(cdrBatch);
      return;
    }
    setCdrRows(prev => {
      const ids = new Set(prev.map(r => r.id));
      return [...prev, ...cdrBatch.filter(r => !ids.has(r.id))];
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
        sipControls?.answerCall();
        useCallsStore.getState().removeIncomingCall(incomingRing.id);
        setActiveCall(incomingRing);
        answer.mutate(incomingRing.id, { onSuccess: c => setActiveCall(c) });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        decline.mutate(incomingRing.id);
        useCallsStore.getState().removeIncomingCall(incomingRing.id);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [incomingRing, sipControls, answer, decline, setActiveCall]);

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
    if (activeCall && !isDemoDataEnabled()) {
      void endCall(activeCall.id).catch(() => undefined);
    }
    setActiveCall(null);
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
    const phone = record.customerPhone?.trim();
    if (phone) return phone;
    if (isDemoDataEnabled()) {
      return (
        contactCache.get(record.callSessionId) ??
        demoCallerName({ id: record.callSessionId, customerPhone: record.callSessionId })
      );
    }
    return record.agentLabel || record.callSessionId.slice(0, 8);
  }

  return (
    <div className="flex h-full min-h-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* ── Left sidebar: queues, active, recent ─────────────────────── */}
      <aside className="w-60 shrink-0 border-e border-white/10 bg-slate-950/80 flex flex-col min-h-0 backdrop-blur-sm">
        {/* SIP status banner */}
        {!isDemoDataEnabled() && (
          <div
            className={cn(
              'px-3 py-2 text-[11px] leading-snug border-b border-white/10 flex items-start gap-2',
              sipRegistered
                ? 'bg-emerald-500/10 text-emerald-300'
                : 'bg-amber-500/10 text-amber-200',
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

        {/* PSTN / WhatsApp tabs */}
        <div className="flex border-b border-white/10">
          {(['pstn', 'whatsapp'] as const).map(t => (
            <button
              key={t}
              type="button"
              aria-pressed={transport === t}
              onClick={() => setTransport(t)}
              className={cn(
                'flex-1 py-2 text-xs font-medium capitalize border-b-2 -mb-px transition-colors',
                transport === t
                  ? 'text-sky-400 border-sky-400'
                  : 'text-slate-500 border-transparent hover:text-slate-300',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
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

          <div className="flex items-center justify-between px-3 pt-3 pb-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Recent
            </p>
            <Link
              href="/calling/history"
              className="text-[10px] font-semibold text-brand-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {cdrRows.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No recent calls</p>
          ) : (
            cdrRows.map(r => (
              <CdrListItem
                key={r.id}
                record={r}
                label={cdrLabel(r)}
                active={selectedId === r.callSessionId}
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

      {/* ── Center cockpit ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0 bg-slate-900/50">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {selected ? resolveCallerName(selected, contactCache) : 'Communication cockpit'}
            </p>
            <p className="text-xs text-slate-500">
              {selected
                ? `${selected.transport === 'whatsapp' ? 'WhatsApp' : 'Voice'} · ${selected.customerPhone}`
                : 'Voice · chat · CRM · AI in one workspace'}
            </p>
          </div>
          <AgentStateSelector />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-5">
          {incomingRing && (
            <IncomingCallHero
              call={incomingRing}
              contactCache={contactCache}
              onAnswer={() => {
                sipControls?.answerCall();
                useCallsStore.getState().removeIncomingCall(incomingRing.id);
                setActiveCall(incomingRing);
                answer.mutate(incomingRing.id, { onSuccess: c => setActiveCall(c) });
              }}
              onDecline={() => {
                decline.mutate(incomingRing.id);
                useCallsStore.getState().removeIncomingCall(incomingRing.id);
              }}
            />
          )}

          {activeCall && !incomingRing && (
            <ActiveCallStage
              call={activeCall}
              contactCache={contactCache}
              muted={muted}
              held={held}
              sipRegistered={sipRegistered}
              sipError={sipError}
              onMute={() => sipControls?.toggleMute()}
              onHold={handleHold}
              onTransfer={() => setTransferOpen(true)}
              onHangup={handleHangup}
              onRecord={() => toast.info('Recording is managed server-side automatically')}
            />
          )}

          {showEmptyCenter && !incomingRing && (
            <div className="flex flex-col items-center py-8 px-4 text-center animate-cw-float-in">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center mb-4 text-sky-300">
                <PhoneIncoming size={32} aria-hidden />
              </div>
              <h2 className="text-lg font-semibold text-white">Ready for live conversations</h2>
              <p className="text-sm text-slate-500 mt-2 max-w-md">
                Your smart cockpit unifies PSTN, WhatsApp, CRM, tickets, and AI assist — pick a call
                or dial below.
              </p>
              {!sipRegistered && transport === 'pstn' && (
                <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-4 max-w-sm">
                  Register softphone for PSTN — or use WhatsApp outbound without SIP.
                </p>
              )}
            </div>
          )}

          {showEmptyCenter && (
            <div className="max-w-sm mx-auto cw-glass rounded-2xl p-4">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3 text-center">
                Quick dial
              </p>
              <DialPad
                transport={transport}
                disabled={!user}
                onCall={async (number, t) => {
                  if (t === 'pstn') {
                    if (!makeCall || !sipRegistered) {
                      toast.error('Softphone not connected.');
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
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="cw-glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Queue stats
                </p>
              </div>
              {queueDisplay.length === 0 ? (
                <p className="text-sm text-slate-500">No queues configured</p>
              ) : (
                <ul className="space-y-2">
                  {queueDisplay.map(q => (
                    <li
                      key={q.id}
                      className="flex justify-between gap-2 text-sm py-2 border-b border-white/5 last:border-0"
                    >
                      <span className="font-medium truncate text-slate-200">{q.name}</span>
                      <span className="text-slate-500 text-xs shrink-0 tabular-nums">
                        {q.stats?.waiting ?? 0} waiting · {q.stats?.avgWaitSec ?? 0}s
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="cw-glass rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Today
              </p>
              <p className="text-3xl font-bold text-white tabular-nums">{todayRows.length}</p>
              <p className="text-sm text-slate-500 mt-0.5">calls today</p>
              <p className="text-sm text-rose-400 mt-2 font-medium">
                {todayRows.filter(r => r.outcome === 'missed').length} missed today
              </p>
            </div>
          </div>

          <RecordingsPanel />

          {isSupervisor && selected && (
            <div className="cw-glass rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Supervisor
              </p>
              <div className="flex gap-2">
                {(['Listen', 'Whisper', 'Barge'] as const).map(label => (
                  <button
                    key={label}
                    type="button"
                    aria-label={`${label} into call`}
                    className="px-3 py-1.5 text-xs border border-white/10 rounded-lg text-slate-300 hover:bg-white/5 transition-colors"
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

      <CustomerContextPanel
        call={activeCall ?? incomingRing ?? null}
        collapsed={contextCollapsed}
        onToggle={() => setContextCollapsed(c => !c)}
      />

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
