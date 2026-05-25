'use client';

import { useEffect, useState, type ElementType } from 'react';
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
import { CallSessionItem, CdrListItem } from '@/components/calling/CallListItem';
import { CallTimer } from '@/components/calling/CallTimer';
import { DialPad } from '@/components/calling/DialPad';
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
  const [transport, setTransport] = useState<'pstn' | 'whatsapp'>('pstn');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [cdrPage, setCdrPage] = useState(1);
  const [cdrRows, setCdrRows] = useState<CDRRecord[]>([]);

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

  const incomingRing = incoming[0] ?? activeList.find(s => s.status === 'ringing');
  const isSupervisor = can(user?.role, 'supervisorListen');
  const queueDisplay = queues.length > 0 ? queues : [];
  const showEmptyCenter = !activeCall && !incomingRing && !selected;
  const sampleStats = !isDemoDataEnabled() && queueDisplay.length > 0 && cdrRows.length > 0;

  useEffect(() => {
    if (!selectedId && filtered.length > 0) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

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
    sipControls?.blindTransfer(t);
    setTransferOpen(false);
    setTransferTarget('');
    toast.success(`Transferring to ${t}`);
  };

  function cdrLabel(record: CDRRecord): string {
    return (
      contactCache.get(record.callSessionId) ??
      demoCallerName({ id: record.callSessionId, customerPhone: record.callSessionId })
    );
  }

  return (
    <div className="flex h-full min-h-0 bg-slate-50">
      <aside className="w-56 shrink-0 border-e border-gray-200 bg-white flex flex-col min-h-0">
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
                  <span className="font-medium">Softphone offline</span>
                  <span className="block text-[10px] text-amber-800/90 mt-0.5">
                    {sipError ?? 'PSTN needs Asterisk/Kamailio. WhatsApp outbound still works.'}
                  </span>
                </>
              )}
            </span>
          </div>
        )}

        <div className="flex border-b border-gray-100">
          {(['pstn', 'whatsapp'] as const).map(t => (
            <button
              key={t}
              type="button"
              aria-pressed={transport === t}
              onClick={() => setTransport(t)}
              className={cn(
                'flex-1 py-2 text-xs font-medium capitalize border-b-2 -mb-px transition-colors',
                transport === t
                  ? 'text-brand-primary border-brand-primary'
                  : 'text-gray-500 border-transparent hover:text-gray-700',
              )}
            >
              {t}
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

      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {selected ? resolveCallerName(selected, contactCache) : 'Call workspace'}
            </p>
            <p className="text-xs text-gray-500">
              {selected
                ? `${selected.transport === 'whatsapp' ? 'WhatsApp' : 'Voice'} · ${selected.customerPhone}`
                : 'Select a call or dial from the keypad'}
            </p>
          </div>
          <AgentStateSelector />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
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
              {!sipRegistered && transport === 'pstn' && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-4 max-w-sm">
                  PSTN dial-out requires a registered softphone. Try the WhatsApp tab for outbound
                  without SIP.
                </p>
              )}
            </div>
          )}
          {incomingRing && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
              <div className="w-11 h-11 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-sm font-semibold shrink-0">
                {resolveCallerName(incomingRing, contactCache).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  {resolveCallerName(incomingRing, contactCache)}
                </p>
                <p className="text-xs text-green-700">{incomingRing.customerPhone}</p>
              </div>
              <button
                type="button"
                aria-label="Answer call"
                className="w-11 h-11 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shadow-sm transition-colors"
                onClick={() =>
                  answer.mutate(incomingRing.id, {
                    onSuccess: c => {
                      setActiveCall(c);
                      sipControls?.answerCall();
                      useCallsStore.getState().removeIncomingCall(incomingRing.id);
                    },
                  })
                }
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
                  onClick={() => toast.info('Recording is managed by Asterisk')}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-100 p-4 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Queue stats
                </p>
                {sampleStats && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    Sample
                  </span>
                )}
              </div>
              {queueDisplay.length === 0 ? (
                <p className="text-sm text-muted-foreground">No queues configured</p>
              ) : (
                <ul className="space-y-2">
                  {queueDisplay.map(q => (
                    <li
                      key={q.id}
                      className="flex justify-between gap-2 text-sm py-2 border-b border-gray-50 last:border-0"
                    >
                      <span className="font-medium truncate">{q.name}</span>
                      <span className="text-gray-500 text-xs shrink-0 tabular-nums">
                        {q.stats?.waiting ?? 0} waiting · {q.stats?.avgWaitSec ?? 0}s
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-gray-100 p-4 bg-white shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Today
              </p>
              <p className="text-3xl font-bold text-gray-900 tabular-nums">{cdrRows.length}</p>
              <p className="text-sm text-gray-500 mt-0.5">calls in history</p>
              <p className="text-sm text-red-600 mt-2 font-medium">
                {cdrRows.filter(r => r.outcome === 'missed').length} missed
              </p>
            </div>
          </div>

          {isSupervisor && selected && (
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

      <aside className="w-64 shrink-0 border-s border-gray-200 bg-white flex flex-col min-h-0">
        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0">
          Dial pad
        </p>
        <DialPad
          className="flex-1 min-h-0"
          transport={transport}
          disabled={!user}
          onCall={async (number, t) => {
            if (t === 'pstn') {
              makeCall?.(number);
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

      <Dialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Blind transfer"
        className="sm:max-w-sm"
      >
        <p className="text-sm text-muted-foreground">
          Enter the extension or phone number to transfer this call to.
        </p>
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Extension or +968..."
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
            Transfer
          </Button>
        </div>
      </Dialog>
    </div>
  );
}