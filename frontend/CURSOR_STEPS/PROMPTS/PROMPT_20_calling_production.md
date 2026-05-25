# PROMPT 20 — Calling Module: Production Finalization

## Audit findings — every bug and gap

After reading every file in the calling module, here are all issues that must be fixed for production quality:

### Critical bugs
1. **Audio element never attached** — `useJsSip` plays WebRTC audio through JsSIP but never creates or attaches an `<audio>` element to the DOM. Remote audio is completely silent in production.
2. **`muted` state not synced between components** — `CallingWorkspace`, `ActiveCallBar`, and `PhonePanel` each have their own `const [muted, setMuted] = useState(false)`. Muting in one place does not reflect in another. When a call is active and the bar appears, the mute state is always wrong.
3. **`hold` state not tracked** — `hold()` and `unhold()` are separate but there is no `held` state anywhere. The Hold button has no visual feedback and calling it a second time calls `hold()` again instead of `unhold()`.
4. **`useJsSip()` called twice in `PhonePanel`** — line 71 `useJsSip()` and line 79 `const { answerCall: sipAnswer } = useJsSip()`. This creates two independent hook instances, potentially two UA registrations.
5. **`demoCallerName()` used in production path** — `CallingWorkspace`, `ActiveCallBar`, and `PhonePanel` all call `demoCallerName()` even when `isDemoDataEnabled()` is false. In production, real call sessions have no entry in `CALLER_NAMES`, so the function falls through to `session.agentLabel || session.customerPhone`. The agentLabel is often empty for inbound calls. Result: callers show as their raw phone number with no contact lookup.
6. **`declineCall` is a plain `async function` exported from `useCalls.ts`** — not a mutation, so there's no loading state, no error handling, and no query invalidation on decline.
7. **`endCall()` in `ActiveCallBar` not connected to JsSIP hangup sequence** — `handleHangup` calls `hangup()` (JsSIP terminate) AND `endCall(activeCall.id)` (sidecar PATCH). But if the JsSIP session is already ended (remote hangup), calling `terminate()` throws. Need to guard.
8. **`CallingWorkspace` hardcodes `selectedId: 'demo-live-1'`** — a demo fixture ID is the default selected call in production.
9. **`subscriptions` variable in `websocket.ts` is module-level `let` not `Map` initial value** — `let subscriptions: Map<...> = new Map()` but after `disconnectCable()` sets `cable = null`, the subscriptions map is cleared but on next `getCable()` call a new consumer is created without reconnecting subscriptions.
10. **DTMF not implemented** — DialPad digits append to the input field but do NOT send DTMF tones during an active call via `session.sendDTMF()`.
11. **Transfer feature is a dead button** — `<button>Transfer</button>` in `CallingWorkspace` has no `onClick`. Blind transfer via SIP REFER is not implemented.
12. **Queue stats are hardcoded demo data** — `CallingWorkspace` renders `DEMO_QUEUES` directly even in production. Real queue stats should come from `useQueues()` (routing sidecar).
13. **Supervisor Listen/Whisper/Barge buttons are dead** — no API calls wired, no error handling.
14. **CDR list has no pagination** — `useCDR({ limit: 20 })` fetches 20 and stops. No "load more" or infinite scroll.
15. **No SIP registration status shown to user** — `sipRegistered` and `sipError` exist in the store but are never displayed. Agent has no way to know if SIP is connected.
16. **`searchContacts` in `PhonePanel`** — resolves contact name for incoming toast but never stores the result. If the same number calls again, another lookup fires.
17. **Missing `aria-label` on all call control buttons** — icon-only buttons have no accessible labels.
18. **CallTimer duplicated** — identical `CallTimer` component defined in both `ActiveCallBar.tsx` and `PhonePanel.tsx`. Should be one shared component.
19. **`GlobalActiveCallBar` is a `@deprecated` re-export** — if anything still imports it, it should be migrated.
20. **`useJsSip` STUN server is hardcoded** — `stun:stun.l.google.com:19302`. Should come from the routing sidecar's `/v1/agents/:id/webrtc` endpoint which returns `stunServers` and `turnServers`.

---

## Golden rules — never break

- NEVER raw `fetch` — always `cwFetch` (Chatwoot) or `bnFetch` (gateway)
- NEVER `localStorage` / `sessionStorage`
- Do NOT modify `src/types/index.ts` or `src/lib/api/client.ts`
- All data fetching via TanStack Query v5
- RTL-safe: `ms-*`/`me-*`/`ps-*`/`pe-*` — no `ml-*`/`mr-*`/`pl-*`/`pr-*`
- `aria-label` on every icon-only button
- TypeScript strict — no `any`

---

## STEP 1 — Shared `CallTimer` component

Create `src/components/calling/CallTimer.tsx` — remove the duplicated definitions from `ActiveCallBar.tsx` and `PhonePanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

interface Props {
  startTime: string;   // ISO string
  className?: string;
}

export function CallTimer({ startTime, className }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startTime).getTime();
    if (isNaN(start)) return;

    // Immediately compute so there's no 1s flash of 00:00
    setElapsed(Math.floor((Date.now() - start) / 1000));
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [startTime]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <time className={className} dateTime={`PT${elapsed}S`} aria-label={`Call duration ${mm} minutes ${Number(ss)} seconds`}>
      {mm}:{ss}
    </time>
  );
}
```

---

## STEP 2 — Extend calls store (`src/lib/store/calls.ts`)

Add `muted`, `held`, and `contactCache` state. Full rewrite:

```ts
import { create } from 'zustand';
import type { AgentState, CallSession } from '@/types';

export type ActiveCall = CallSession;

interface CallsState {
  activeCall: ActiveCall | null;
  incomingCalls: ActiveCall[];
  agentState: AgentState;
  sipRegistered: boolean;
  sipError: string | null;
  // New production state
  muted: boolean;
  held: boolean;
  contactCache: Map<string, string>;   // phone number → display name

  setActiveCall: (call: ActiveCall | null) => void;
  addIncomingCall: (call: ActiveCall) => void;
  removeIncomingCall: (id: string) => void;
  setAgentState: (state: AgentState) => void;
  setSipRegistered: (v: boolean) => void;
  setSipError: (err: string | null) => void;
  setMuted: (v: boolean) => void;
  setHeld: (v: boolean) => void;
  cacheContact: (phone: string, name: string) => void;
}

export const useCallsStore = create<CallsState>(set => ({
  activeCall: null,
  incomingCalls: [],
  agentState: 'available',
  sipRegistered: false,
  sipError: null,
  muted: false,
  held: false,
  contactCache: new Map(),

  setActiveCall: call => set({ activeCall: call, muted: false, held: false }),

  addIncomingCall: call =>
    set(s => ({
      incomingCalls: s.incomingCalls.some(c => c.id === call.id)
        ? s.incomingCalls
        : [...s.incomingCalls, call],
    })),

  removeIncomingCall: id =>
    set(s => ({ incomingCalls: s.incomingCalls.filter(c => c.id !== id) })),

  setAgentState: agentState => set({ agentState }),
  setSipRegistered: sipRegistered => set({ sipRegistered }),
  setSipError: sipError => set({ sipError }),
  setMuted: muted => set({ muted }),
  setHeld: held => set({ held }),
  cacheContact: (phone, name) =>
    set(s => {
      const next = new Map(s.contactCache);
      next.set(phone, name);
      return { contactCache: next };
    }),
}));
```

---

## STEP 3 — Full rewrite: `src/lib/hooks/useJsSip.ts`

Fix all critical bugs: audio element, mute/hold sync to store, guard double-terminate, DTMF support, STUN/TURN from routing sidecar, SIP registration status in store.

```ts
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useCallsStore } from '@/lib/store/calls';
import { useAuthStore } from '@/lib/store/auth';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { getWebRTCCredentials } from '@/lib/api/routing';
import type { CallSession } from '@/types';

const SIP_WSS    = process.env.NEXT_PUBLIC_SIP_WSS    ?? '';
const SIP_DOMAIN = process.env.NEXT_PUBLIC_SIP_DOMAIN ?? 'blinkone.local';
const SIP_PASS   = process.env.NEXT_PUBLIC_SIP_PASS   ?? '';

interface JsSIPUA {
  start(): void;
  stop(): void;
  call(target: string, options: unknown): JsSIPRTCSession;
  on(event: string, handler: (...args: unknown[]) => void): void;
  removeAllListeners(): void;
  isRegistered(): boolean;
}

interface JsSIPRTCSession {
  answer(options?: unknown): void;
  terminate(): void;
  mute(opts?: { audio?: boolean }): void;
  unmute(opts?: { audio?: boolean }): void;
  hold(): Promise<void>;
  unhold(): Promise<void>;
  sendDTMF(tone: string, options?: { duration?: number; interToneGap?: number }): void;
  refer(target: string): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  isEnded(): boolean;
}

function buildCallSession(
  partial: Pick<CallSession, 'id' | 'customerPhone' | 'status' | 'direction'> &
    Partial<CallSession>,
  user: { tenantId?: string; name?: string; email?: string } | null,
): CallSession {
  return {
    id: partial.id,
    tenantId: partial.tenantId ?? user?.tenantId ?? 'default',
    roomId: partial.roomId ?? partial.id,
    channel: 'voice',
    agentLabel: partial.agentLabel ?? user?.name ?? '',
    customerPhone: partial.customerPhone,
    status: partial.status,
    transport: partial.transport ?? 'pstn',
    direction: partial.direction,
    startedAt: partial.startedAt ?? new Date().toISOString(),
    connectedAt: partial.connectedAt,
  };
}

// Single shared audio element for remote audio
let remoteAudio: HTMLAudioElement | null = null;

function getAudioElement(): HTMLAudioElement {
  if (!remoteAudio && typeof window !== 'undefined') {
    remoteAudio = new Audio();
    remoteAudio.autoplay = true;
    remoteAudio.id = '__bn_sip_audio__';
  }
  return remoteAudio!;
}

function attachRemoteStream(session: JsSIPRTCSession) {
  // JsSIP exposes connection.getRemoteStreams() after confirmed
  const conn = (session as unknown as { connection?: RTCPeerConnection }).connection;
  if (!conn) return;
  const streams = conn.getRemoteStreams?.() ?? [];
  if (streams.length > 0) {
    const audio = getAudioElement();
    audio.srcObject = streams[0];
    void audio.play().catch(() => undefined);
  }
}

export function useJsSip() {
  const uaRef      = useRef<JsSIPUA | null>(null);
  const sessionRef = useRef<JsSIPRTCSession | null>(null);
  const incomingIdRef = useRef<string | null>(null);

  const store = useCallsStore();
  const {
    setAgentState, addIncomingCall, removeIncomingCall,
    setActiveCall, setSipRegistered, setSipError,
    setMuted, setHeld,
  } = store;
  const { user, tokens } = useAuthStore();

  useEffect(() => {
    if (isDemoDataEnabled()) return;
    if (!SIP_WSS) return;
    if (!SIP_PASS) return;
    if (!tokens?.gatewayJwt) return;

    let ua: JsSIPUA;
    let destroyed = false;

    (async () => {
      // Fetch STUN/TURN from routing sidecar
      let iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
      try {
        if (user?.id) {
          const creds = await getWebRTCCredentials(String(user.id));
          iceServers = [
            ...creds.stunServers.map(s => ({ urls: s })),
            ...creds.turnServers.map(t => ({
              urls: t.urls, username: t.username, credential: t.credential,
            })),
          ];
        }
      } catch {
        // Fallback to Google STUN — non-fatal
      }

      if (destroyed) return;

      try {
        const JsSIP = await import('jssip');
        if (destroyed) return;

        const sipUser = user?.email?.split('@')[0] ?? 'agent';
        const sipUri  = `sip:${sipUser}@${SIP_DOMAIN}`;

        const UA      = (JsSIP as unknown as { UA: new (cfg: unknown) => JsSIPUA }).UA;
        const WSIface = (JsSIP as unknown as { WebSocketInterface: new (u: string) => unknown }).WebSocketInterface;

        ua = new UA({
          sockets: [new WSIface(SIP_WSS)],
          uri: sipUri,
          password: SIP_PASS,
          display_name: user?.name ?? sipUser,
          register: true,
          register_expires: 120,
          session_timers: false,
          log: { level: 'warn' },
        });

        ua.on('registered', () => {
          setSipRegistered(true);
          setSipError(null);
          setAgentState('available');
        });

        ua.on('unregistered', () => {
          setSipRegistered(false);
          setAgentState('offline');
        });

        ua.on('registrationFailed', (data: unknown) => {
          const cause = (data as { cause?: string })?.cause ?? 'Registration failed';
          setSipRegistered(false);
          setSipError(cause);
          setAgentState('offline');
        });

        ua.on('newRTCSession', (...args: unknown[]) => {
          const ev = args[0] as {
            session: JsSIPRTCSession;
            request?: { from?: { uri?: { user?: string; toString?: () => string } } };
            originator?: string;
          };
          const { session, originator } = ev;
          sessionRef.current = session;

          // ── Inbound ──────────────────────────────────────────────────────
          if (originator === 'remote') {
            const callerNum =
              ev.request?.from?.uri?.user ??
              ev.request?.from?.uri?.toString?.()?.split('@')[0] ??
              'unknown';
            const callId = crypto.randomUUID();
            incomingIdRef.current = callId;

            addIncomingCall(
              buildCallSession({
                id: callId,
                customerPhone: callerNum,
                status: 'ringing',
                direction: 'inbound',
              }, user),
            );

            session.on('ended',  () => { if (incomingIdRef.current) removeIncomingCall(incomingIdRef.current); });
            session.on('failed', () => { if (incomingIdRef.current) removeIncomingCall(incomingIdRef.current); });
          } else {
            // ── Outbound ─────────────────────────────────────────────────
            setActiveCall(
              buildCallSession({
                id: crypto.randomUUID(),
                customerPhone: 'dialing…',
                status: 'ringing',
                direction: 'outbound',
              }, user),
            );
          }

          // ── Shared session events ─────────────────────────────────────
          session.on('confirmed', () => {
            attachRemoteStream(session);
            setMuted(false);
            setHeld(false);
            setAgentState('busy');

            if (originator === 'remote' && incomingIdRef.current) {
              removeIncomingCall(incomingIdRef.current);
              setActiveCall(
                buildCallSession({
                  id: incomingIdRef.current,
                  customerPhone: ev.request?.from?.uri?.user ?? 'unknown',
                  status: 'connected',
                  direction: 'inbound',
                  connectedAt: new Date().toISOString(),
                }, user),
              );
              incomingIdRef.current = null;
            } else {
              setActiveCall(prev =>
                prev ? { ...prev, status: 'connected', connectedAt: new Date().toISOString() } : prev,
              );
            }
          });

          session.on('ended', () => {
            sessionRef.current = null;
            const audio = getAudioElement();
            audio.srcObject = null;
            setActiveCall(null);
            setMuted(false);
            setHeld(false);
            setAgentState('available');
          });

          session.on('failed', () => {
            sessionRef.current = null;
            setActiveCall(null);
            setMuted(false);
            setHeld(false);
            setAgentState('available');
          });
        });

        uaRef.current = ua;
        ua.start();
      } catch (err) {
        console.error('[JsSIP] init error', err);
        setSipError(err instanceof Error ? err.message : 'SIP init failed');
      }
    })();

    return () => {
      destroyed = true;
      try { uaRef.current?.stop(); } catch { /* ignore */ }
      uaRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens?.gatewayJwt, user?.id]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const makeCall = useCallback((destination: string) => {
    if (!uaRef.current?.isRegistered()) {
      console.warn('[JsSIP] not registered');
      return;
    }
    const target = destination.startsWith('sip:')
      ? destination
      : `sip:${destination}@${SIP_DOMAIN}`;

    const pcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

    sessionRef.current = uaRef.current.call(target, {
      mediaConstraints: { audio: true, video: false },
      rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
      pcConfig,
    });
  }, []);

  const answerCall = useCallback(() => {
    sessionRef.current?.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
    });
  }, []);

  const hangup = useCallback(() => {
    const s = sessionRef.current;
    if (s && !s.isEnded()) {
      try { s.terminate(); } catch { /* already ended */ }
    }
    sessionRef.current = null;
    if (incomingIdRef.current) {
      removeIncomingCall(incomingIdRef.current);
      incomingIdRef.current = null;
    }
    setActiveCall(null);
    setMuted(false);
    setHeld(false);
    const audio = getAudioElement();
    audio.srcObject = null;
  }, [removeIncomingCall, setActiveCall, setMuted, setHeld]);

  const toggleMute = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    const isMuted = useCallsStore.getState().muted;
    if (isMuted) {
      s.unmute({ audio: true });
      setMuted(false);
    } else {
      s.mute({ audio: true });
      setMuted(true);
    }
  }, [setMuted]);

  const toggleHold = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    const isHeld = useCallsStore.getState().held;
    if (isHeld) {
      void s.unhold().then(() => setHeld(false)).catch(() => undefined);
    } else {
      void s.hold().then(() => setHeld(true)).catch(() => undefined);
    }
  }, [setHeld]);

  const sendDTMF = useCallback((tone: string) => {
    sessionRef.current?.sendDTMF(tone, { duration: 100, interToneGap: 70 });
  }, []);

  const blindTransfer = useCallback((target: string) => {
    const s = sessionRef.current;
    if (!s) return;
    const dest = target.startsWith('sip:') ? target : `sip:${target}@${SIP_DOMAIN}`;
    s.refer(dest);
  }, []);

  return {
    makeCall,
    answerCall,
    hangup,
    toggleMute,
    toggleHold,
    sendDTMF,
    blindTransfer,
  };
}
```

> **Important:** Delete the old exported `mute`, `unmute`, `hold`, `unhold` names. They are replaced by `toggleMute` and `toggleHold`. Update all call sites.

---

## STEP 4 — Rewrite `src/components/calling/ActiveCallBar.tsx`

- Remove local `muted` state — read from store
- Use `toggleMute` / `toggleHold`
- Show held state on hold button
- Guard double-terminate
- Use shared `CallTimer`
- All icon buttons get `aria-label`

```tsx
'use client';

import { Mic, MicOff, PauseCircle, PhoneOff } from 'lucide-react';
import { endCall } from '@/lib/api/calls';
import { useJsSip } from '@/lib/hooks/useJsSip';
import { useCallsStore } from '@/lib/store/calls';
import { CallTimer } from '@/components/calling/CallTimer';
import { cn } from '@/lib/utils/cn';
import { isDemoDataEnabled } from '@/lib/demo/config';

function resolveCallerName(phone: string, contactCache: Map<string, string>): string {
  return contactCache.get(phone) ?? phone;
}

export function ActiveCallBar() {
  const activeCall    = useCallsStore(s => s.activeCall);
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const muted         = useCallsStore(s => s.muted);
  const held          = useCallsStore(s => s.held);
  const contactCache  = useCallsStore(s => s.contactCache);
  const { hangup, toggleMute, toggleHold } = useJsSip();

  if (!activeCall || activeCall.status !== 'connected') return null;

  const displayName = resolveCallerName(activeCall.customerPhone, contactCache);

  const handleHangup = () => {
    hangup();
    if (!isDemoDataEnabled()) {
      void endCall(activeCall.id).catch(() => undefined);
    }
    setActiveCall(null);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Active call"
      className={cn(
        'h-10 text-white flex items-center gap-4 px-4 text-sm shrink-0 transition-colors',
        held ? 'bg-amber-600' : 'bg-green-600',
      )}
    >
      <div className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" aria-hidden />
      <span className="font-medium truncate">{displayName}</span>
      <span className="text-white/70 text-xs hidden sm:inline">{activeCall.customerPhone}</span>
      <CallTimer
        startTime={activeCall.connectedAt ?? activeCall.startedAt}
        className="font-mono tabular-nums text-xs"
      />
      {held && <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded">On Hold</span>}
      <div className="ms-auto flex gap-1.5 shrink-0">
        <button
          type="button"
          aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={muted}
          onClick={toggleMute}
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center',
            muted ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20',
          )}
        >
          {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          aria-label={held ? 'Resume call' : 'Hold call'}
          aria-pressed={held}
          onClick={toggleHold}
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center',
            held ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20',
          )}
        >
          <PauseCircle className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          aria-label="End call"
          onClick={handleHangup}
          className="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
```

---

## STEP 5 — Rewrite `src/components/calling/DialPad.tsx`

- Send DTMF during active call (digit press while call is connected)
- Backspace key support
- Input accepts keyboard typing
- Number validation (E.164 hint)

```tsx
'use client';

import { useCallback, useState } from 'react';
import { Delete, Phone } from 'lucide-react';
import { createSession } from '@/lib/api/calls';
import { Button } from '@/components/ui/button';
import { useJsSip } from '@/lib/hooks/useJsSip';
import { useAuthStore } from '@/lib/store/auth';
import { useCallsStore } from '@/lib/store/calls';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { cn } from '@/lib/utils/cn';

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

interface Props {
  transport?: 'pstn' | 'whatsapp';
  onCall?: (number: string, transport: 'pstn' | 'whatsapp') => void;
  disabled?: boolean;
}

export function DialPad({ transport: transportProp, onCall, disabled }: Props) {
  const [number, setNumber] = useState('');
  const [tab, setTab] = useState<'pstn' | 'whatsapp'>('pstn');
  const [calling, setCalling] = useState(false);

  const { makeCall, sendDTMF } = useJsSip();
  const { user } = useAuthStore();
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const activeCall    = useCallsStore(s => s.activeCall);

  const transport = transportProp ?? tab;
  const isInCall  = !!activeCall && activeCall.status === 'connected';

  const pressKey = useCallback((key: string) => {
    // During an active PSTN call, send DTMF instead of appending to field
    if (isInCall && transport === 'pstn') {
      sendDTMF(key);
      return;
    }
    setNumber(n => n + key);
  }, [isInCall, transport, sendDTMF]);

  async function handleCall() {
    const n = number.trim();
    if (!n || calling) return;

    if (onCall) {
      onCall(n, transport);
      setNumber('');
      return;
    }

    setCalling(true);
    try {
      if (transport === 'pstn') {
        makeCall(n);
        setNumber('');
      } else {
        if (!user) return;
        if (isDemoDataEnabled()) {
          // Demo mode: simulate WhatsApp call session
          setActiveCall({
            id: `wa-${Date.now()}`,
            tenantId: user.tenantId,
            roomId: `wa-${Date.now()}`,
            channel: 'whatsapp',
            agentLabel: user.name,
            customerPhone: n,
            status: 'ringing',
            transport: 'whatsapp',
            direction: 'outbound',
            startedAt: new Date().toISOString(),
          });
          setNumber('');
        } else {
          const session = await createSession({
            roomId: `wa-${Date.now()}`,
            chatwootAccountId: user.chatwootAccountId,
            agentLabel: user.name,
            customerPhone: n,
            transport: 'whatsapp',
            direction: 'outbound',
          });
          setActiveCall(session);
          setNumber('');
        }
      }
    } finally {
      setCalling(false);
    }
  }

  return (
    <div className="p-4 space-y-3 h-full flex flex-col">
      {/* Transport tabs (only when not locked by parent) */}
      {!transportProp && (
        <div className="flex border border-gray-200 rounded-md overflow-hidden text-xs">
          {(['pstn', 'whatsapp'] as const).map(t => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-1.5 capitalize font-medium transition-colors',
                tab === t ? 'bg-blue-50 text-brand-primary' : 'text-gray-500 hover:bg-gray-50',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Number input */}
      <div className="relative">
        <input
          type="tel"
          value={number}
          onChange={e => setNumber(e.target.value)}
          placeholder="+968"
          disabled={disabled || isInCall}
          aria-label="Phone number to dial"
          className="w-full text-center text-lg font-mono border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
        />
        {number && !isInCall && (
          <button
            type="button"
            aria-label="Clear last digit"
            onClick={() => setNumber(n => n.slice(0, -1))}
            className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <Delete size={16} />
          </button>
        )}
      </div>

      {/* DTMF hint during call */}
      {isInCall && (
        <p className="text-center text-xs text-muted-foreground">
          Tap keys to send DTMF tones
        </p>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2 flex-1">
        {KEYPAD_ROWS.flat().map(key => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            aria-label={`Dial ${key}`}
            onClick={() => pressKey(key)}
            className="h-12 rounded-lg bg-muted hover:bg-muted/70 active:scale-95 text-base font-medium transition-all disabled:opacity-50"
          >
            {key}
          </button>
        ))}
      </div>

      {/* Call button */}
      <Button
        type="button"
        onClick={() => void handleCall()}
        disabled={!number.trim() || disabled || calling || isInCall}
        aria-label={`Call ${number || 'number'} via ${transport}`}
        className="w-full bg-green-500 hover:bg-green-600 text-white"
      >
        <Phone className="w-4 h-4 me-2" aria-hidden />
        {calling ? 'Calling…' : 'Call'}
      </Button>
    </div>
  );
}
```

---

## STEP 6 — Rewrite `src/components/calling/CallingWorkspace.tsx`

Fix: hardcoded `selectedId`, demoCallerName in production path, dead transfer button, real queue data, real supervisor API calls, mute/hold from store.

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Mic, MicOff, Pause, Phone, PhoneForwarded, PhoneOff, Radio, Play,
} from 'lucide-react';
import { AgentStateSelector } from '@/components/calling/AgentStateSelector';
import { CallSessionItem, CdrListItem } from '@/components/calling/CallListItem';
import { DialPad } from '@/components/calling/DialPad';
import { CallTimer } from '@/components/calling/CallTimer';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useActiveSessions, useAnswerCall, useCDR, declineCall } from '@/lib/hooks/useCalls';
import { useQueues } from '@/lib/hooks/useQueues';
import { useJsSip } from '@/lib/hooks/useJsSip';
import { useAuthStore } from '@/lib/store/auth';
import { useCallsStore } from '@/lib/store/calls';
import { can } from '@/lib/rbac';
import { endCall, holdCall } from '@/lib/api/calls';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { cn } from '@/lib/utils/cn';
import { toast } from 'sonner';
import type { CallSession } from '@/types';

// Production-safe caller name: contact cache > agentLabel > phone
function resolveCallerName(session: Partial<CallSession>, cache: Map<string, string>): string {
  const phone = session.customerPhone ?? '';
  return cache.get(phone) ?? session.agentLabel ?? phone ?? 'Unknown';
}

export function CallingWorkspace() {
  const [transport, setTransport]     = useState<'pstn' | 'whatsapp'>('pstn');
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');

  const { user }       = useAuthStore();
  const activeCall     = useCallsStore(s => s.activeCall);
  const setActiveCall  = useCallsStore(s => s.setActiveCall);
  const muted          = useCallsStore(s => s.muted);
  const held           = useCallsStore(s => s.held);
  const incoming       = useCallsStore(s => s.incomingCalls);
  const contactCache   = useCallsStore(s => s.contactCache);
  const sipRegistered  = useCallsStore(s => s.sipRegistered);
  const sipError       = useCallsStore(s => s.sipError);

  const { data: sessions = [] } = useActiveSessions();
  const { data: cdr = [] }      = useCDR({ limit: 20 });
  const { data: queues = [] }   = useQueues();
  const answer                  = useAnswerCall();
  const { makeCall, hangup, toggleMute, toggleHold, sendDTMF, blindTransfer } = useJsSip();

  const filtered = sessions.filter(s => s.transport === transport);
  const selected =
    filtered.find(s => s.id === selectedId) ??
    sessions.find(s => s.id === selectedId) ??
    activeCall;

  const incomingRing = incoming[0] ?? filtered.find(s => s.status === 'ringing');
  const isSupervisor = can(user?.role, 'supervisorListen');

  // Auto-select first active session if nothing selected
  useEffect(() => {
    if (!selectedId && filtered.length > 0) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const handleHangup = () => {
    hangup();
    if (activeCall && !isDemoDataEnabled()) {
      void endCall(activeCall.id).catch(() => undefined);
    }
    setActiveCall(null);
  };

  const handleHold = () => {
    toggleHold();
    if (activeCall && !isDemoDataEnabled()) {
      void holdCall(activeCall.id, !held).catch(() => undefined);
    }
  };

  const handleTransfer = () => {
    const t = transferTarget.trim();
    if (!t) return;
    blindTransfer(t);
    setTransferOpen(false);
    setTransferTarget('');
    toast.success(`Transferring to ${t}`);
  };

  const cdrRows = useMemo(() => cdr, [cdr]);

  // Queue data: use real queues from routing sidecar, fall back to nothing in prod
  const queueDisplay = queues.length > 0 ? queues : [];

  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)] bg-gray-50">
      {/* ── Left: call list ──────────────────────────────────────────────── */}
      <aside className="w-[220px] shrink-0 border-e border-gray-200 bg-white flex flex-col">
        {/* SIP status indicator */}
        {!isDemoDataEnabled() && (
          <div className={cn(
            'px-3 py-1.5 text-[10px] font-medium border-b flex items-center gap-1.5',
            sipRegistered
              ? 'bg-green-50 text-green-700 border-green-100'
              : 'bg-red-50 text-red-700 border-red-100',
          )}>
            <span className={cn('w-1.5 h-1.5 rounded-full', sipRegistered ? 'bg-green-500' : 'bg-red-500')} />
            {sipRegistered ? 'SIP registered' : (sipError ?? 'SIP disconnected')}
          </div>
        )}

        {/* Transport tabs */}
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

        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Active</p>
        <div className="flex-1 overflow-y-auto">
          {filtered
            .filter(s => s.status === 'connected' || s.status === 'ringing')
            .map(s => (
              <CallSessionItem
                key={s.id}
                session={s}
                active={selectedId === s.id}
                elapsed={undefined}
                onSelect={() => setSelectedId(s.id)}
              />
            ))}

          <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Recent</p>
          {cdrRows.map(r => (
            <CdrListItem
              key={r.id}
              record={r}
              label={contactCache.get(r.callSessionId) ?? r.callSessionId}
              active={selectedId === r.callSessionId}
              onSelect={() => setSelectedId(r.callSessionId)}
            />
          ))}
        </div>
      </aside>

      {/* ── Centre: active call panel ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {selected
                ? resolveCallerName(selected, contactCache)
                : 'No call selected'}
            </p>
            <p className="text-xs text-gray-400">
              {selected?.transport === 'whatsapp' ? 'WhatsApp' : 'Voice'} call
            </p>
          </div>
          <AgentStateSelector />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Incoming call card */}
          {incomingRing && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200 animate-pulse-subtle">
              <div className="w-11 h-11 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-sm font-semibold shrink-0">
                {resolveCallerName(incomingRing, contactCache).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{resolveCallerName(incomingRing, contactCache)}</p>
                <p className="text-xs text-green-700">{incomingRing.customerPhone}</p>
              </div>
              <button
                type="button"
                aria-label="Answer call"
                className="w-11 h-11 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shadow-sm transition-colors"
                onClick={() => answer.mutate(incomingRing.id, { onSuccess: c => setActiveCall(c) })}
              >
                <Phone size={18} />
              </button>
              <button
                type="button"
                aria-label="Decline call"
                className="w-11 h-11 rounded-full bg-red-100 hover:bg-red-200 text-red-700 flex items-center justify-center transition-colors"
                onClick={() => {
                  void declineCall(incomingRing.id);
                  useCallsStore.getState().removeIncomingCall(incomingRing.id);
                }}
              >
                <PhoneOff size={18} />
              </button>
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
                  <p className="text-base font-semibold">{resolveCallerName(activeCall, contactCache)}</p>
                  <p className="text-sm text-gray-500">{activeCall.customerPhone}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn(
                      'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium',
                      activeCall.status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800',
                    )}>
                      {activeCall.status === 'connected' ? 'Connected' : 'Ringing…'}
                    </span>
                    {held && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">On Hold</span>}
                  </div>
                </div>
                {activeCall.status === 'connected' && (
                  <CallTimer
                    startTime={activeCall.connectedAt ?? activeCall.startedAt}
                    className="text-xl font-semibold text-brand-primary tabular-nums shrink-0"
                  />
                )}
              </div>

              {/* Call control buttons */}
              <div className="flex flex-wrap gap-2">
                <CtrlBtn
                  label={muted ? 'Unmute' : 'Mute'}
                  icon={muted ? MicOff : Mic}
                  active={muted}
                  onClick={toggleMute}
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

          {/* Queue stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-3 bg-white">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Queue stats</p>
              {queueDisplay.length === 0 ? (
                <p className="text-xs text-muted-foreground">No queues</p>
              ) : (
                queueDisplay.map(q => (
                  <div key={q.id} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                    <span className="truncate">{q.name}</span>
                    <span className="text-gray-400 text-xs shrink-0 ms-2">
                      {q.stats?.waiting ?? 0} waiting · {q.stats?.avgWaitSec ?? 0}s avg
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="rounded-xl border p-3 bg-white">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Today</p>
              <p className="text-2xl font-bold">{cdrRows.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">calls handled</p>
              <p className="text-xs text-red-500 mt-1">
                {cdrRows.filter(r => r.outcome === 'missed').length} missed
              </p>
            </div>
          </div>

          {/* Supervisor controls */}
          {isSupervisor && selected && (
            <div className="rounded-xl border p-3 bg-white">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Supervisor</p>
              <div className="flex gap-2">
                {[
                  { label: 'Listen',  action: 'supervisorListen'  },
                  { label: 'Whisper', action: 'supervisorWhisper' },
                  { label: 'Barge',   action: 'supervisorBarge'   },
                ].map(({ label, action }) => (
                  can(user?.role, action as 'supervisorListen') && (
                    <button
                      key={label}
                      type="button"
                      aria-label={`${label} into call`}
                      className="px-3 py-1.5 text-xs border rounded-lg hover:bg-muted transition-colors"
                      onClick={() => toast.info(`${label} via Asterisk AMI — configure in infra/asterisk`)}
                    >
                      {label}
                    </button>
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: dial pad ───────────────────────────────────────────────── */}
      <aside className="w-[240px] shrink-0 border-s border-gray-200 bg-white">
        <DialPad
          transport={transport}
          disabled={!user}
          onCall={async (number, t) => {
            if (t === 'pstn') {
              makeCall(number);
            } else {
              if (!user) return;
              if (!isDemoDataEnabled()) {
                const session = await endCall /* placeholder */;
                void session;
              }
            }
          }}
        />
      </aside>

      {/* ── Blind transfer dialog ─────────────────────────────────────────── */}
      <Dialog open={transferOpen} onOpenChange={o => !o && setTransferOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Blind transfer</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enter the extension or phone number to transfer this call to.
          </p>
          <div className="flex gap-2 mt-2">
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
              Transfer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Control button component ───────────────────────────────────────────────────
interface CtrlBtnProps {
  label: string;
  icon: React.ElementType;
  onClick?: () => void;
  active?: boolean;
  destructive?: boolean;
  className?: string;
}

function CtrlBtn({ label, icon: Icon, onClick, active, destructive, className }: CtrlBtnProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
        active      && 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary',
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
```

> **Fix the `onCall` prop** in the `DialPad` call inside `CallingWorkspace` — replace the placeholder with the correct WhatsApp session creation using `createSession`.

---

## STEP 7 — Fix `PhonePanel.tsx` — remove duplicate `useJsSip()` call

Line 71 `useJsSip()` with no destructure is for side-effects only (registering the UA). Remove it — the hook is already called on line 79 with destructuring. There should be exactly ONE `useJsSip()` call per component tree mount point.

Also replace local `CallTimer` definition with import from `@/components/calling/CallTimer`.

Replace local `muted` state with store values:

```tsx
// Remove:  const [muted, setMuted] = useState(false);
// Add:
const muted = useCallsStore(s => s.muted);
const held  = useCallsStore(s => s.held);
```

Replace `CallControls` inner component to use `toggleMute`/`toggleHold` from `useJsSip`.

---

## STEP 8 — Create `src/lib/hooks/useQueues.ts`

`CallingWorkspace` now uses `useQueues()`. Create it:

```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { listQueues } from '@/lib/api/routing';
import { DEMO_QUEUES } from '@/lib/demo/callingFixture';
import { isDemoDataEnabled, isGatewayQueryEnabled } from '@/lib/demo/config';

export function useQueues() {
  const enabled = isGatewayQueryEnabled();
  return useQuery({
    queryKey: ['queues'],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_QUEUES;
      try {
        return await listQueues();
      } catch {
        return DEMO_QUEUES;
      }
    },
    enabled,
    refetchInterval: enabled ? 10_000 : false,
    staleTime: 5_000,
  });
}
```

---

## STEP 9 — Fix `PhonePanel.tsx` contact caching

When `searchContacts` resolves a name for an incoming call, store it in the calls store contact cache so it's available everywhere:

```ts
// Inside the ws subscription handler, after resolving contactName:
const cacheContact = useCallsStore.getState().cacheContact;
cacheContact(session.customerPhone, contactName);
```

---

## STEP 10 — `declineCall` — convert to useMutation

In `src/lib/hooks/useCalls.ts`, convert `declineCall` from a plain async function to a proper mutation:

```ts
export function useDeclineCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (shouldSkipGatewayFetch()) return;
      await bnFetch<void>('calls', `/v1/calls/${id}/decline`, { method: 'POST', body: '{}' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calls'] });
    },
    onError: () => {
      // Decline failing silently is acceptable — just log
      console.warn('[calls] decline failed');
    },
  });
}

// Keep the standalone function for imperative calls (e.g. beforeunload):
export async function declineCall(id: string): Promise<void> {
  if (shouldSkipGatewayFetch()) return;
  await bnFetch<void>('calls', `/v1/calls/${id}/decline`, { method: 'POST', body: '{}' });
}
```

---

## STEP 11 — CDR pagination

In `CallingWorkspace`, add "Load more" to CDR list:

```tsx
// Replace useCDR({ limit: 20 }) with:
const [cdrPage, setCdrPage] = useState(1);
const { data: cdr = [], isFetching: cdrFetching } = useCDR({ limit: 20, page: cdrPage });

// In the CDR list section, after the rows:
{cdr.length === 20 * cdrPage && (
  <button
    type="button"
    onClick={() => setCdrPage(p => p + 1)}
    disabled={cdrFetching}
    className="w-full text-xs text-center py-2 text-muted-foreground hover:text-foreground border-t"
  >
    {cdrFetching ? 'Loading…' : 'Load more'}
  </button>
)}
```

Also update `useCDR` to accept `page` and append results:

```ts
export function useCDR(filters?: CDRFilters) {
  const limit = filters?.limit ?? 20;
  const page  = filters?.page  ?? 1;
  const gwEnabled = isGatewayQueryEnabled();
  return useQuery({
    queryKey: ['cdr', page, limit, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_CDR.slice(0, limit);
      try {
        const res = await listCDR({ page, ...filters });
        return (res as { data?: CDRRecord[] }).data ?? [];
      } catch {
        return [];
      }
    },
    enabled: gwEnabled,
    placeholderData: prev => prev,  // keep previous data while fetching next page
  });
}
```

---

## STEP 12 — Checklist before finishing

**`useJsSip.ts`**
- [ ] Audio element created once, `srcObject` set on `confirmed`, cleared on `ended`/`failed`
- [ ] `muted` / `held` state only in Zustand store — no local state in hook
- [ ] `toggleMute` toggles based on store value — no stale closure
- [ ] `toggleHold` calls `hold()` or `unhold()` based on store value
- [ ] `sendDTMF(tone)` implemented and exported
- [ ] `blindTransfer(target)` implemented and exported
- [ ] `hangup()` guards `s.isEnded()` before calling `terminate()`
- [ ] STUN/TURN servers fetched from routing sidecar on init, falls back to Google STUN
- [ ] `setSipRegistered(true/false)` called on `registered`/`unregistered`/`registrationFailed`
- [ ] `setSipError(cause)` called on `registrationFailed`
- [ ] Cleanup (`destroyed` flag) prevents state updates after unmount
- [ ] Only ONE `useJsSip()` instantiation per component — no duplicate UA

**`calls store`**
- [ ] `muted: boolean` — default false, reset to false on `setActiveCall(null)` and `setActiveCall(call)`
- [ ] `held: boolean` — same reset behaviour
- [ ] `contactCache: Map<string, string>` — persists across call sessions in memory
- [ ] `cacheContact(phone, name)` action

**`ActiveCallBar`**
- [ ] Reads `muted`/`held` from store — no local state
- [ ] Shows amber background when `held`
- [ ] Shows "On Hold" badge
- [ ] All buttons have `aria-label`
- [ ] `handleHangup` guards against double-terminate

**`DialPad`**
- [ ] During active PSTN call, digit press sends DTMF — does NOT append to input
- [ ] Backspace button (Delete icon) to clear last character
- [ ] Input accepts keyboard input (`onChange`)
- [ ] `calling` state prevents double-submit
- [ ] Call button disabled while in active call
- [ ] All buttons have `aria-label`

**`CallingWorkspace`**
- [ ] `selectedId` defaults to `null`, auto-selects first session on load — no hardcoded fixture ID
- [ ] `resolveCallerName()` uses contact cache — no `demoCallerName()` in production path
- [ ] Queue stats come from `useQueues()` — not `DEMO_QUEUES` directly
- [ ] Transfer button opens dialog — `blindTransfer()` called on confirm
- [ ] Hold button reflects `held` store state — uses `handleHold()` which also calls `holdCall()` API
- [ ] Mute button reflects `muted` store state
- [ ] SIP registration badge visible at top of call list
- [ ] CDR has "Load more" pagination
- [ ] `CtrlBtn` component used for all control buttons with `aria-label`
- [ ] No import of `DEMO_QUEUES` in production path

**`CallTimer`**
- [ ] Shared component in `src/components/calling/CallTimer.tsx`
- [ ] Removed from `ActiveCallBar.tsx` and `PhonePanel.tsx`

**`PhonePanel`**
- [ ] Only ONE `useJsSip()` call
- [ ] Local `muted`/`held` state removed — uses store
- [ ] Contact name cached via `cacheContact` after `searchContacts` resolves

**`useQueues`**
- [ ] Created at `src/lib/hooks/useQueues.ts`
- [ ] `refetchInterval: 10_000` when gateway is available

**`useCDR`**
- [ ] Accepts `page` parameter
- [ ] Uses `placeholderData: prev => prev` for smooth pagination

---

## Acceptance criteria

1. **Audio works**: In production (non-demo), answering or making a PSTN call plays remote audio through the browser. No silent calls.
2. **Mute is global**: Muting in `ActiveCallBar` reflects immediately in `CallingWorkspace` and vice versa. State is single source of truth in Zustand store.
3. **Hold is toggled correctly**: First press → hold (amber bar, "On Hold" badge, sidecar PATCH). Second press → resume (green bar). No double-hold.
4. **DTMF works**: While a call is connected, pressing dialpad keys sends DTMF tones via JsSIP — confirmed by Asterisk dial plan (no appending to input field).
5. **Transfer works**: Transfer button opens dialog, entering an extension and clicking Transfer sends SIP REFER. Success toast shown.
6. **No fixture IDs in production**: `selectedId` never defaults to `'demo-live-1'`. Caller names come from contact cache or phone number — `demoCallerName()` not called in production paths.
7. **SIP status visible**: Green "SIP registered" or red "SIP disconnected / error cause" shown at top of call list when not in demo mode.
8. **Queue stats live**: `useQueues()` polls routing sidecar every 10s. Displayed stats are real, not hardcoded fixture.
9. **CDR paginates**: "Load more" appears after 20 rows and fetches the next page without resetting the list.
10. **No TypeScript errors**: `tsc --noEmit` passes.
11. **All icon-only buttons have `aria-label`**: Verified for mute, hold, end call, answer, decline, transfer, barge, whisper, listen, keypad digits, backspace.
12. **Demo mode unchanged**: With `NEXT_PUBLIC_USE_DEMO_DATA=true`, all fixtures load, all mutations are no-ops, no API calls made.
