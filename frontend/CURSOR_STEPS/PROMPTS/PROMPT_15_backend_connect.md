# CURSOR PROMPT — STEP 15: Backend Connection & Error Hardening
> Paste this ENTIRE file into Cursor Composer.
> Goal: Every API call connects correctly to Chatwoot + BlinkOne gateway with zero unhandled errors.
> Read `.cursorrules` before writing anything.
> Do NOT modify `src/lib/api/*.ts`, `src/types/index.ts`, or `src/lib/store/auth.ts` — they are correct.

---

## ARCHITECTURE OVERVIEW (read-only reference — do not change these files)

```
Browser → Next.js rewrites → Chatwoot :3000   (/_cw/* → Chatwoot REST)
                           → Gateway  :8080   (/_gw/* → BlinkOne microservices)

Auth flow:
  1. POST /_cw/auth/sign_in          → returns access_token (Chatwoot)
  2. POST /_gw/api/auth/token        → exchanges CW token for gateway JWT
  3. All Chatwoot calls use:         api_access_token: <accessToken> header
  4. All gateway calls use:          Authorization: Bearer <gatewayJwt> header
  5. WebSocket:                      /_cw/cable?access_token=<token>  (Action Cable)
  6. SIP/WebRTC:                     NEXT_PUBLIC_SIP_WSS  (JsSIP)

API clients (already correct — do not touch):
  cwFetch(path, init, version)   → Chatwoot REST
  bnFetch(service, path, init)   → BlinkOne gateway sidecar

Demo mode: NEXT_PUBLIC_USE_DEMO_DATA=true → hooks fall back to fixtures, skip real API calls
Gateway guard: shouldSkipGatewayFetch() → skip bnFetch when no JWT or demo mode
```

---

## PART A — Fix `src/lib/hooks/useJsSip.ts`

This hook is used throughout the calling components. Make it robust to missing SIP config.

### FULL REWRITE `src/lib/hooks/useJsSip.ts`:

```ts
'use client';

/**
 * JsSIP WebRTC hook.
 * Connects to the SIP WSS endpoint from env.
 * If SIP is not configured (no WSS URL) or in demo mode, all methods are no-ops.
 */

import { useEffect, useRef } from 'react';
import { useCallsStore } from '@/lib/store/calls';
import { useAuthStore } from '@/lib/store/auth';
import { isDemoDataEnabled } from '@/lib/demo/config';

const SIP_WSS = process.env.NEXT_PUBLIC_SIP_WSS ?? '';
const SIP_DOMAIN = process.env.NEXT_PUBLIC_SIP_DOMAIN ?? 'blinkone.local';

// Singleton UA — only one JsSIP.UA per browser session
let ua: import('jssip').UA | null = null;

function sipEnabled(): boolean {
  return !isDemoDataEnabled() && !!SIP_WSS && typeof window !== 'undefined';
}

export function useJsSip() {
  const setActiveCall = useCallsStore(s => s.setActiveCall);
  const addIncoming = useCallsStore(s => s.addIncomingCall);
  const { user, tokens } = useAuthStore();
  const sessionRef = useRef<import('jssip').RTCSession | null>(null);

  useEffect(() => {
    if (!sipEnabled() || !user || !tokens?.gatewayJwt || ua) return;

    let mounted = true;

    async function initUA() {
      try {
        const JsSIP = await import('jssip');

        const socket = new JsSIP.WebSocketInterface(SIP_WSS);
        const configuration: import('jssip').UAConfiguration = {
          sockets: [socket],
          uri: `sip:${user!.id}@${SIP_DOMAIN}`,
          password: tokens!.gatewayJwt,
          register: true,
          session_timers: false,
        };

        ua = new JsSIP.UA(configuration);

        ua.on('registered', () => {
          console.info('[JsSIP] Registered');
        });

        ua.on('registrationFailed', (e: unknown) => {
          console.warn('[JsSIP] Registration failed', e);
        });

        ua.on('newRTCSession', ({ session }: { session: import('jssip').RTCSession }) => {
          if (!mounted) return;
          sessionRef.current = session;

          if (session.direction === 'incoming') {
            addIncoming({
              id: session.id,
              sessionId: session.id,
              status: 'ringing',
              direction: 'inbound',
              remoteNumber: session.remote_identity?.uri?.user ?? 'Unknown',
              customerPhone: session.remote_identity?.uri?.user ?? 'Unknown',
              startedAt: new Date().toISOString(),
              transport: 'pstn',
            });
          }

          session.on('ended', () => {
            if (!mounted) return;
            setActiveCall(null);
          });

          session.on('failed', () => {
            if (!mounted) return;
            setActiveCall(null);
          });
        });

        ua.start();
      } catch (e) {
        console.warn('[JsSIP] Failed to initialize:', e);
      }
    }

    void initUA();

    return () => {
      mounted = false;
    };
  }, [user, tokens, setActiveCall, addIncoming]);

  function makeCall(number: string) {
    if (!sipEnabled() || !ua) {
      console.info('[JsSIP] Demo mode — simulating outbound call to', number);
      setActiveCall({
        id: `demo-${Date.now()}`,
        sessionId: `demo-${Date.now()}`,
        status: 'connected',
        direction: 'outbound',
        remoteNumber: number,
        customerPhone: number,
        startedAt: new Date().toISOString(),
        connectedAt: new Date().toISOString(),
        transport: 'pstn',
      });
      return;
    }

    const session = ua.call(`sip:${number}@${SIP_DOMAIN}`, {
      mediaConstraints: { audio: true, video: false },
      rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
    });

    sessionRef.current = session;

    session.on('accepted', () => {
      setActiveCall({
        id: session.id,
        sessionId: session.id,
        status: 'connected',
        direction: 'outbound',
        remoteNumber: number,
        customerPhone: number,
        startedAt: new Date().toISOString(),
        connectedAt: new Date().toISOString(),
        transport: 'pstn',
      });
    });
  }

  function answerCall() {
    if (!sessionRef.current) return;
    sessionRef.current.answer({ mediaConstraints: { audio: true, video: false } });
  }

  function hangup() {
    if (!sessionRef.current) {
      setActiveCall(null);
      return;
    }
    try {
      sessionRef.current.terminate();
    } catch {
      // already ended
    }
    setActiveCall(null);
  }

  function mute() {
    sessionRef.current?.mute({ audio: true });
  }

  function unmute() {
    sessionRef.current?.unmute({ audio: true });
  }

  function hold() {
    sessionRef.current?.hold();
  }

  function unhold() {
    sessionRef.current?.unhold();
  }

  return { makeCall, answerCall, hangup, mute, unmute, hold, unhold };
}
```

---

## PART B — Fix `src/lib/store/calls.ts`

The calls store must have all fields that components reference. Full rewrite:

```ts
import { create } from 'zustand';
import type { CallSession } from '@/types';

// Extend CallSession with UI-only fields
export interface ActiveCall extends CallSession {
  connectedAt?: string;
  agentLabel?: string;
}

type AgentState = 'available' | 'busy' | 'break' | 'offline';

interface CallsState {
  activeCall: ActiveCall | null;
  incomingCalls: ActiveCall[];
  agentState: AgentState;
  setActiveCall: (call: ActiveCall | null) => void;
  addIncomingCall: (call: ActiveCall) => void;
  removeIncomingCall: (id: string) => void;
  setAgentState: (state: AgentState) => void;
}

export const useCallsStore = create<CallsState>((set) => ({
  activeCall: null,
  incomingCalls: [],
  agentState: 'available',

  setActiveCall: (call) => set({ activeCall: call }),

  addIncomingCall: (call) =>
    set((s) => ({
      incomingCalls: s.incomingCalls.some((c) => c.id === call.id)
        ? s.incomingCalls
        : [...s.incomingCalls, call],
    })),

  removeIncomingCall: (id) =>
    set((s) => ({ incomingCalls: s.incomingCalls.filter((c) => c.id !== id) })),

  setAgentState: (agentState) => set({ agentState }),
}));
```

---

## PART C — Fix `src/lib/store/inbox.ts`

```ts
import { create } from 'zustand';

interface InboxState {
  selectedConversationId: number | null;
  draftContent: string;
  setSelectedConversationId: (id: number | null) => void;
  setDraftContent: (content: string) => void;
}

export const useInboxStore = create<InboxState>((set) => ({
  selectedConversationId: null,
  draftContent: '',
  setSelectedConversationId: (id) => set({ selectedConversationId: id }),
  setDraftContent: (content) => set({ draftContent: content }),
}));
```

---

## PART D — Fix `src/types/index.ts` — add missing fields

Add these fields to existing interfaces (do NOT remove existing fields):

**`CallSession`** — add `connectedAt`, `transport`, `agentLabel` if not already present:
```ts
export interface CallSession {
  id: string;
  sessionId: string;
  status: 'ringing' | 'connected' | 'held' | 'ended';
  direction: 'inbound' | 'outbound';
  remoteNumber: string;
  customerPhone: string;          // alias for remoteNumber (sidecar uses this)
  contactName?: string;
  contactId?: number;
  queueId?: string;
  startedAt: string;
  connectedAt?: string;           // when call was answered
  agentLabel?: string;            // display name override
  transport?: 'pstn' | 'whatsapp';
}
```

**`CDRRecord`** — add `outcome` and `transport`:
```ts
export interface CDRRecord {
  id: string;
  direction: 'inbound' | 'outbound';
  remoteNumber: string;
  contactName?: string;
  status: 'answered' | 'missed' | 'voicemail';
  outcome: 'answered' | 'missed' | 'voicemail' | 'completed'; // from sidecar
  duration: number;               // seconds (sidecar field name)
  durationSecs?: number;          // alias
  startedAt: string;
  endedAt?: string;
  queueId?: string;
  agentId?: string;
  transport: 'pstn' | 'whatsapp'; // channel used
}
```

**`RoutingAgent`** — ensure this interface exists:
```ts
export interface RoutingAgent {
  agentId: string;
  name: string;
  state: 'available' | 'busy' | 'break' | 'offline';
  currentSessionId?: string;
  durationSecs?: number;
  handledToday?: number;
  extension?: string;
}
```

**`AgentState`** — export the type:
```ts
export type AgentState = 'available' | 'busy' | 'break' | 'offline';
```

**`Queue`** — ensure this interface exists:
```ts
export interface Queue {
  id: string;
  name: string;
  strategy: string;
  maxWaitSecs: number;
  agents: string[];
  enabled: boolean;
}
```

---

## PART E — Fix `src/lib/hooks/useAgentState.ts`

```ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAgents, setAgentState } from '@/lib/api/routing';
import { shouldSkipGatewayFetch } from '@/lib/demo/config';
import type { RoutingAgent } from '@/types';

const DEMO_AGENTS: RoutingAgent[] = [
  { agentId: '1', name: 'Ahmed Al-Rashidi', state: 'available', handledToday: 12 },
  { agentId: '2', name: 'Fatima Hassan', state: 'busy', handledToday: 8, currentSessionId: 'demo-1' },
  { agentId: '3', name: 'Mohammed Al-Balushi', state: 'break', handledToday: 5 },
  { agentId: '4', name: 'Sara Al-Zadjali', state: 'offline', handledToday: 0 },
];

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async (): Promise<RoutingAgent[]> => {
      if (shouldSkipGatewayFetch()) return DEMO_AGENTS;
      try {
        return await listAgents();
      } catch {
        return DEMO_AGENTS;
      }
    },
    refetchInterval: 5_000,
  });
}

export function useSetAgentState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, state }: { agentId: string; state: string }) =>
      setAgentState(agentId, state as RoutingAgent['state']),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });
}
```

---

## PART F — Fix `src/lib/hooks/useMessages.ts`

If this file exists as a re-export shim, replace it with a full implementation:

```ts
'use client';

// Re-export from useConversations for backwards compat
export { useMessages, useSendMessage } from '@/lib/hooks/useConversations';
```

---

## PART G — Fix `src/lib/utils/conversations.ts`

These helpers are used in `useConversations.ts` and must match the Chatwoot API response shape:

```ts
import type { CWConversation } from '@/types';

/**
 * Chatwoot listConversations returns:
 * { data: { payload: CWConversation[], meta: { ... } } }
 * OR
 * { payload: CWConversation[] }
 */
export function parseConversationList(
  res: unknown,
): CWConversation[] {
  if (!res || typeof res !== 'object') return [];
  const r = res as Record<string, unknown>;

  // Shape: { data: { payload: [...] } }
  if (r.data && typeof r.data === 'object') {
    const d = r.data as Record<string, unknown>;
    if (Array.isArray(d.payload)) return d.payload as CWConversation[];
    if (Array.isArray(d)) return d as CWConversation[];
  }

  // Shape: { payload: [...] }
  if (Array.isArray(r.payload)) return r.payload as CWConversation[];

  return [];
}

export function extractConversationMeta(res: unknown): { next_page?: number } {
  if (!res || typeof res !== 'object') return {};
  const r = res as Record<string, unknown>;

  const meta =
    (r.data as Record<string, unknown> | undefined)?.meta ??
    r.meta;

  if (!meta || typeof meta !== 'object') return {};
  const m = meta as Record<string, unknown>;

  return {
    next_page: typeof m.next_page === 'number' ? m.next_page : undefined,
  };
}
```

---

## PART H — Fix `src/lib/demo/conversationsFixture.ts`

This file provides fallback data when demo mode is enabled or API calls fail.
Ensure it exports: `DEMO_CONVERSATIONS`, `DEMO_MESSAGES`, `isFixtureConversationId`.

```ts
import type { CWConversation, CWMessage } from '@/types';

const FIXTURE_IDS = new Set([1, 2, 3, 4, 5]);

export function isFixtureConversationId(id: number): boolean {
  return FIXTURE_IDS.has(id);
}

export const DEMO_CONVERSATIONS: CWConversation[] = [
  {
    id: 1,
    status: 'open',
    inbox_id: 1,
    inbox_name: 'WhatsApp',
    channel: 'whatsapp',
    meta: {
      sender: { id: 101, name: 'Ahmed Al-Rashidi', avatar: undefined },
      assignee: { id: 1, name: 'Agent Demo' },
    },
    last_activity_at: Math.floor(Date.now() / 1000) - 300,
    created_at: Math.floor(Date.now() / 1000) - 86400,
    unread_count: 2,
    labels: ['enterprise'],
    messages: [{ id: 1001, content: 'Hello, I need help with my fiber plan.', message_type: 0, created_at: Math.floor(Date.now() / 1000) - 300 }],
  },
  {
    id: 2,
    status: 'open',
    inbox_id: 2,
    inbox_name: 'Email',
    channel: 'email',
    meta: {
      sender: { id: 102, name: 'Fatima Hassan', avatar: undefined },
    },
    last_activity_at: Math.floor(Date.now() / 1000) - 1800,
    created_at: Math.floor(Date.now() / 1000) - 172800,
    unread_count: 0,
    labels: ['professional'],
    messages: [{ id: 2001, content: 'Can you check my invoice?', message_type: 0, created_at: Math.floor(Date.now() / 1000) - 1800 }],
  },
  {
    id: 3,
    status: 'pending',
    inbox_id: 1,
    inbox_name: 'WhatsApp',
    channel: 'whatsapp',
    meta: {
      sender: { id: 103, name: 'Mohammed Al-Balushi', avatar: undefined },
    },
    last_activity_at: Math.floor(Date.now() / 1000) - 7200,
    created_at: Math.floor(Date.now() / 1000) - 259200,
    unread_count: 1,
    labels: [],
    messages: [{ id: 3001, content: 'مرحبا، أريد الاستفسار عن الخدمة', message_type: 0, created_at: Math.floor(Date.now() / 1000) - 7200 }],
  },
  {
    id: 4,
    status: 'resolved',
    inbox_id: 3,
    inbox_name: 'Phone',
    channel: 'api',
    meta: {
      sender: { id: 104, name: 'Sara Al-Zadjali', avatar: undefined },
      assignee: { id: 1, name: 'Agent Demo' },
    },
    last_activity_at: Math.floor(Date.now() / 1000) - 86400,
    created_at: Math.floor(Date.now() / 1000) - 432000,
    unread_count: 0,
    labels: ['starter'],
    messages: [{ id: 4001, content: 'Issue resolved, thank you!', message_type: 1, created_at: Math.floor(Date.now() / 1000) - 86400 }],
  },
  {
    id: 5,
    status: 'open',
    inbox_id: 2,
    inbox_name: 'Email',
    channel: 'email',
    meta: {
      sender: { id: 105, name: 'Khalid Nasser', avatar: undefined },
    },
    last_activity_at: Math.floor(Date.now() / 1000) - 60,
    created_at: Math.floor(Date.now() / 1000) - 3600,
    unread_count: 3,
    labels: ['enterprise'],
    messages: [{ id: 5001, content: 'Urgent: service outage affecting our team', message_type: 0, created_at: Math.floor(Date.now() / 1000) - 60 }],
  },
];

export const DEMO_MESSAGES: Record<number, CWMessage[]> = {
  1: [
    { id: 1001, content: 'Hello, I need help with my fiber plan.', message_type: 0, content_type: 'text', created_at: Math.floor(Date.now() / 1000) - 600, sender: { id: 101, name: 'Ahmed Al-Rashidi', type: 'contact' } },
    { id: 1002, content: 'Of course! What plan are you currently on?', message_type: 1, content_type: 'text', created_at: Math.floor(Date.now() / 1000) - 540, sender: { id: 1, name: 'Agent Demo', type: 'user' } },
    { id: 1003, content: 'I am on the 100Mbps plan, but I want to upgrade.', message_type: 0, content_type: 'text', created_at: Math.floor(Date.now() / 1000) - 300, sender: { id: 101, name: 'Ahmed Al-Rashidi', type: 'contact' } },
  ],
  2: [
    { id: 2001, content: 'Can you check my invoice for last month?', message_type: 0, content_type: 'text', created_at: Math.floor(Date.now() / 1000) - 3600, sender: { id: 102, name: 'Fatima Hassan', type: 'contact' } },
    { id: 2002, content: 'Checking your account now...', message_type: 1, content_type: 'text', created_at: Math.floor(Date.now() / 1000) - 3500, sender: { id: 1, name: 'Agent Demo', type: 'user' } },
    { id: 2003, content: 'Customer note: escalate if billing issue persists', message_type: 1, content_type: 'private_note', private: true, created_at: Math.floor(Date.now() / 1000) - 3400, sender: { id: 1, name: 'Agent Demo', type: 'user' } },
  ],
  3: [
    { id: 3001, content: 'مرحبا، أريد الاستفسار عن الخدمة', message_type: 0, content_type: 'text', created_at: Math.floor(Date.now() / 1000) - 7200, sender: { id: 103, name: 'Mohammed Al-Balushi', type: 'contact' } },
    { id: 3002, content: 'أهلاً! كيف يمكنني مساعدتك؟', message_type: 1, content_type: 'text', created_at: Math.floor(Date.now() / 1000) - 7100, sender: { id: 1, name: 'Agent Demo', type: 'user' } },
  ],
  4: [
    { id: 4001, content: 'Issue resolved, thank you!', message_type: 1, content_type: 'text', created_at: Math.floor(Date.now() / 1000) - 86400, sender: { id: 1, name: 'Agent Demo', type: 'user' } },
  ],
  5: [
    { id: 5001, content: 'Urgent: service outage affecting our team', message_type: 0, content_type: 'text', created_at: Math.floor(Date.now() / 1000) - 180, sender: { id: 105, name: 'Khalid Nasser', type: 'contact' } },
    { id: 5002, content: 'I am looking into this right now.', message_type: 1, content_type: 'text', created_at: Math.floor(Date.now() / 1000) - 120, sender: { id: 1, name: 'Agent Demo', type: 'user' } },
    { id: 5003, content: 'Can you confirm which services are down?', message_type: 1, content_type: 'text', created_at: Math.floor(Date.now() / 1000) - 60, sender: { id: 1, name: 'Agent Demo', type: 'user' } },
  ],
};
```

---

## PART I — Fix `src/lib/demo/callingFixture.ts`

```ts
import type { CallSession, CDRRecord } from '@/types';

export const DEMO_CALLS: CallSession[] = [
  {
    id: 'demo-1',
    sessionId: 'demo-1',
    status: 'connected',
    direction: 'inbound',
    remoteNumber: '+96891234567',
    customerPhone: '+96891234567',
    contactName: 'Ahmed Al-Rashidi',
    startedAt: new Date(Date.now() - 120_000).toISOString(),
    connectedAt: new Date(Date.now() - 115_000).toISOString(),
    transport: 'pstn',
  },
  {
    id: 'demo-2',
    sessionId: 'demo-2',
    status: 'ringing',
    direction: 'inbound',
    remoteNumber: '+96899876543',
    customerPhone: '+96899876543',
    contactName: 'Mohammed Al-Balushi',
    startedAt: new Date(Date.now() - 15_000).toISOString(),
    transport: 'pstn',
  },
];

export const DEMO_CDR: CDRRecord[] = [
  {
    id: 'cdr-1',
    direction: 'inbound',
    remoteNumber: '+96891234567',
    contactName: 'Ahmed Al-Rashidi',
    status: 'answered',
    outcome: 'answered',
    duration: 245,
    durationSecs: 245,
    startedAt: new Date(Date.now() - 3_600_000).toISOString(),
    endedAt: new Date(Date.now() - 3_354_000).toISOString(),
    transport: 'pstn',
  },
  {
    id: 'cdr-2',
    direction: 'outbound',
    remoteNumber: '+97150987654',
    contactName: 'Fatima Hassan',
    status: 'answered',
    outcome: 'completed',
    duration: 132,
    durationSecs: 132,
    startedAt: new Date(Date.now() - 7_200_000).toISOString(),
    endedAt: new Date(Date.now() - 7_068_000).toISOString(),
    transport: 'pstn',
  },
  {
    id: 'cdr-3',
    direction: 'inbound',
    remoteNumber: '+96855443322',
    contactName: 'Unknown',
    status: 'missed',
    outcome: 'missed',
    duration: 0,
    durationSecs: 0,
    startedAt: new Date(Date.now() - 10_800_000).toISOString(),
    endedAt: new Date(Date.now() - 10_800_000).toISOString(),
    transport: 'whatsapp',
  },
];

/** Get display name for a CallSession */
export function demoCallerName(session: Partial<CallSession>): string {
  return session.contactName ?? session.agentLabel ?? session.customerPhone ?? session.remoteNumber ?? 'Unknown';
}
```

---

## PART J — Fix `src/lib/demo/callsFixture.ts`

If this file exists separately from `callingFixture.ts`, replace with:

```ts
// Re-export from callingFixture for backwards compat
export { DEMO_CALLS, DEMO_CDR, demoCallerName } from '@/lib/demo/callingFixture';
```

---

## PART K — Fix `src/app/login/page.tsx` (connect to real auth)

The login page must correctly call `loginWithPassword` from `src/lib/api/auth.ts` and set auth store:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loginWithPassword } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore(s => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) });

  async function onSubmit(data: LoginForm) {
    try {
      const result = await loginWithPassword({ email: data.email, password: data.password });
      setAuth(result.user, result.tokens);

      // Role-based redirect
      const role = result.user.role;
      if (role === 'platform_admin') {
        router.push('/platform');
      } else {
        router.push('/conversations');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign in failed');
    }
  }

  return (
    <>
      {/* Two-column layout: left brand panel + right form */}
      <div className="min-h-screen flex">
        {/* Left — brand */}
        <div className="hidden lg:flex lg:w-1/2 bg-brand-primary flex-col items-center justify-center p-12 text-white">
          <div className="max-w-sm text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto">
              <span className="text-2xl font-bold">B</span>
            </div>
            <h1 className="text-3xl font-bold">BlinkOne</h1>
            <p className="text-blue-100 text-lg">
              Unified contact center — calls, chat, and tickets in one place.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-8 text-sm text-blue-100">
              {['Chatwoot inbox', 'SIP calling', 'AI assist', 'Role-based access'].map(f => (
                <div key={f} className="bg-white/10 rounded-lg p-3">{f}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-sm space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Sign in</h2>
              <p className="text-sm text-gray-500 mt-1">
                Enter your Chatwoot credentials to continue.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-brand-primary hover:bg-brand-primary/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground">
              Role is detected automatically from your account.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
```

---

## PART L — Fix `src/lib/api/auth.ts` (truncated at end)

The file was cut off inside `refreshGatewayToken`. Add the missing end:

Find the line: `if (!res.ok) thro`
Replace that line and everything after with:
```ts
  if (!res.ok) throw new Error('Token refresh failed');
  return res.json() as Promise<GatewayTokenResponse>;
}
```

---

## PART M — Fix `src/lib/store/auth.ts` (truncated mid-setAuth)

Find the line: `set({`  inside `setAuth`. Ensure the full store reads:

```ts
import { create } from 'zustand';
import type { BlinkoneUser, AuthTokens } from '@/types';
import { resolveRoleFromAuth } from '@/lib/roles';

interface AuthState {
  user: BlinkoneUser | null;
  tokens: AuthTokens | null;
  setAuth: (user: BlinkoneUser, tokens: AuthTokens) => void;
  clearAuth: () => void;
  updateTokens: (tokens: AuthTokens) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tokens: null,

  setAuth: (user, tokens) => {
    const role = resolveRoleFromAuth(user.role, tokens.gatewayJwt, user.email);
    set({ user: { ...user, role }, tokens });
  },

  clearAuth: () => set({ user: null, tokens: null }),

  updateTokens: (tokens) => set({ tokens }),
}));
```

---

## PART N — Fix WebSocket connection in `src/lib/api/websocket.ts`

The file uses `require('actioncable')` which may fail in strict ESM builds. Replace with a safe dynamic import pattern. Find and replace the `getCable()` function:

```ts
function getCable(): ActionCable.Cable {
  if (cable) return cable;
  if (typeof window === 'undefined') throw new Error('ActionCable requires browser');

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ActionCable = require('actioncable') as typeof import('actioncable');
  const { tokens } = useAuthStore.getState();
  const token = tokens?.accessToken;
  const url = token ? `${WS_URL}?access_token=${encodeURIComponent(token)}` : WS_URL;

  cable = ActionCable.createConsumer(url);
  return cable!;
}
```

Also ensure `actioncable` is in `package.json`. Run:
```bash
npm list actioncable 2>/dev/null || npm install actioncable
```

And add the ActionCable type declaration if missing. Create `src/types/actioncable.d.ts`:

```ts
declare module 'actioncable' {
  interface Subscription {
    unsubscribe(): void;
  }
  interface Subscriptions {
    create(channel: object, callbacks: { received?: (data: unknown) => void; connected?(): void; disconnected?(): void }): Subscription;
  }
  interface Cable {
    subscriptions: Subscriptions;
    disconnect(): void;
  }
  function createConsumer(url: string): Cable;
}

declare namespace ActionCable {
  interface Subscription {
    unsubscribe(): void;
  }
  interface Cable {
    subscriptions: {
      create(channel: object, callbacks: { received?: (data: unknown) => void }): Subscription;
    };
    disconnect(): void;
  }
}
```

---

## PART O — Fix `src/components/layout/RoleGuard.tsx`

This guards all dashboard routes. Ensure it handles the no-tokens case cleanly without redirect loops:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { canAccessRoute } from '@/lib/rbac';

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore(s => s.user);
  const tokens = useAuthStore(s => s.tokens);

  useEffect(() => {
    // Not logged in → go to login
    if (!tokens || !user) {
      router.replace('/login');
      return;
    }
    // Logged in but no permission for this route
    if (!canAccessRoute(user.role, pathname)) {
      router.replace('/conversations');
    }
  }, [tokens, user, pathname, router]);

  // Don't render children until auth confirmed
  if (!tokens || !user) return null;

  return <>{children}</>;
}
```

---

## VERIFICATION CHECKLIST

After completing all parts, run these checks:

```bash
# 1. Type check — must be 0 errors
npm run type-check

# 2. Build check
npm run build

# 3. Check actioncable installed
npm list actioncable

# 4. Check jssip installed
npm list jssip
```

If `jssip` or `actioncable` are missing:
```bash
npm install jssip actioncable
```

### Manual smoke tests (with NEXT_PUBLIC_USE_DEMO_DATA=true):
- [ ] `/login` loads without error, shows email + password fields
- [ ] Submitting demo credentials shows toast error "Cannot reach the API" (expected in demo mode)
- [ ] Navigating to `/_cw/auth/sign_in` proxy resolves (Next.js rewrite works)
- [ ] `/conversations` shows demo conversations list (3-panel layout)
- [ ] Clicking a conversation shows message thread with correct RTL for Arabic messages
- [ ] Reply tab / Note tab visible in ReplyBox
- [ ] `/calling` shows DialPad on the right
- [ ] `/reports` loads Overview chart
- [ ] Sidebar shows correct links for role (set DEMO_ROLE in auth store for testing)

### With real Chatwoot backend (NEXT_PUBLIC_USE_DEMO_DATA=false):
- [ ] Login with valid Chatwoot credentials → redirects to /conversations
- [ ] Conversation list loads from Chatwoot API
- [ ] Sending a message POSTs to Chatwoot and appears in thread
- [ ] New messages arrive via WebSocket without page refresh
- [ ] Agent state selector PATCHes to gateway `/api/routing/v1/agents/:id`
- [ ] No 401 errors in console (tokens properly attached to every request)
- [ ] No CORS errors (all requests go through /_cw and /_gw proxies)

✅ All checks pass? Backend connection is complete.
