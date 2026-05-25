# CURSOR PROMPT — STEP 17: BlinkOne Mobile App (Expo · Customer + Agent)
> Paste this ENTIRE file into Cursor Composer.
> Goal: Production-quality React Native Expo app inside `mobile/` folder.
>       Two roles — Customer and Agent — sharing one codebase.
>       WebRTC calling via react-native-webrtc + JsSIP, chat via Chatwoot API,
>       push notifications, RTL/Arabic support, offline awareness.
> Read `.cursorrules` before writing anything.
> Do NOT modify anything outside `mobile/` except where explicitly stated.

---

## ARCHITECTURE OVERVIEW

```
mobile/
├── app/                        ← Expo Router (file-based navigation)
│   ├── (customer)/             ← Customer role screens
│   │   ├── _layout.tsx
│   │   ├── index.tsx           ← Home: Call Support + Chat + Tickets
│   │   ├── chat/[id].tsx       ← Active chat conversation
│   │   ├── tickets/index.tsx   ← My tickets list
│   │   └── tickets/[id].tsx    ← Ticket detail
│   ├── (agent)/                ← Agent role screens
│   │   ├── _layout.tsx
│   │   ├── index.tsx           ← Dashboard: queue stats + incoming calls
│   │   ├── conversations/
│   │   │   ├── index.tsx       ← All conversations list
│   │   │   └── [id].tsx        ← Conversation detail + chat
│   │   ├── calls/index.tsx     ← Active call screen (CDR history)
│   │   └── settings.tsx        ← Agent profile + state + SIP status
│   ├── auth/
│   │   ├── login.tsx           ← Agent login (email + password)
│   │   └── select-role.tsx     ← First launch: Customer or Agent
│   ├── call-active.tsx         ← Full-screen in-call UI (both roles)
│   ├── _layout.tsx             ← Root layout (providers, fonts, splash)
│   └── +not-found.tsx
├── src/
│   ├── api/
│   │   ├── client.ts           ← cwFetch + bnFetch (identical logic to web)
│   │   ├── auth.ts             ← loginWithPassword, refreshToken
│   │   ├── conversations.ts    ← listConversations, getMessages, sendMessage
│   │   ├── contacts.ts         ← searchContacts, createContact
│   │   ├── calls.ts            ← listActiveSessions, answerCall, endCall
│   │   ├── tickets.ts          ← listTickets, createTicket, getTicket
│   │   └── routing.ts          ← setAgentState, listQueues, getQueueStats
│   ├── store/
│   │   ├── auth.ts             ← Zustand — user + tokens (SecureStore backed)
│   │   ├── calls.ts            ← activeCall, incomingCalls, agentState
│   │   └── ui.ts               ← theme, locale, isRTL
│   ├── hooks/
│   │   ├── useJsSip.ts         ← JsSIP WebRTC over WSS
│   │   ├── useActionCable.ts   ← Chatwoot realtime WebSocket
│   │   ├── useConversations.ts ← TanStack Query conversations
│   │   ├── useMessages.ts      ← TanStack Query messages + optimistic send
│   │   ├── useTickets.ts       ← TanStack Query tickets
│   │   └── usePermissions.ts   ← Microphone permission guard
│   ├── components/
│   │   ├── calling/
│   │   │   ├── IncomingCallSheet.tsx   ← Bottom sheet: answer / decline
│   │   │   ├── ActiveCallBar.tsx       ← Persistent mini-bar during call
│   │   │   └── DialPad.tsx             ← DTMF dial pad
│   │   ├── chat/
│   │   │   ├── MessageBubble.tsx       ← Incoming / outgoing bubble
│   │   │   ├── MessageInput.tsx        ← Text input + attach + send
│   │   │   └── TypingIndicator.tsx     ← Animated dots
│   │   ├── conversations/
│   │   │   ├── ConversationCard.tsx    ← List item with avatar + unread badge
│   │   │   └── StatusBadge.tsx         ← open/resolved/pending pill
│   │   ├── tickets/
│   │   │   ├── TicketCard.tsx          ← Priority color + status
│   │   │   └── PriorityBadge.tsx       ← P1–P4 with color coding
│   │   ├── layout/
│   │   │   ├── AppHeader.tsx           ← Back button + title + right actions
│   │   │   ├── TabBar.tsx              ← Custom bottom tab bar
│   │   │   ├── Avatar.tsx              ← Initials or image with online dot
│   │   │   ├── EmptyState.tsx          ← Icon + message + optional CTA
│   │   │   ├── ErrorBoundary.tsx       ← Catch render errors gracefully
│   │   │   └── OfflineBanner.tsx       ← Network status banner
│   │   └── ui/
│   │       ├── Button.tsx              ← Primary / secondary / ghost / danger
│   │       ├── Badge.tsx               ← Notification count badge
│   │       ├── Skeleton.tsx            ← Loading skeleton (shimmer)
│   │       ├── Toast.tsx               ← In-app toast (success/error/info)
│   │       └── Sheet.tsx               ← Bottom sheet wrapper
│   ├── lib/
│   │   ├── env.ts              ← Typed env var accessors
│   │   ├── storage.ts          ← SecureStore wrapper (tokens) + AsyncStorage (prefs)
│   │   ├── i18n.ts             ← i18next + Arabic/English translations
│   │   ├── theme.ts            ← Colors, spacing, typography tokens
│   │   ├── rbac.ts             ← can() — same logic as web
│   │   └── permissions.ts      ← Microphone + notification permission helpers
│   └── types/
│       └── index.ts            ← All shared types (mirrors web types/index.ts)
├── assets/
│   ├── fonts/                  ← IBM Plex Sans + IBM Plex Sans Arabic
│   ├── images/
│   │   ├── icon.png
│   │   ├── splash.png
│   │   └── adaptive-icon.png
│   └── sounds/
│       └── ringtone.mp3        ← Ringtone for incoming calls
├── app.json                    ← Expo config
├── babel.config.js
├── tsconfig.json
├── metro.config.js             ← metro + NativeWind
├── tailwind.config.js          ← NativeWind theme
├── .env                        ← EXPO_PUBLIC_* vars
└── package.json
```

---

## PART 1 — Project bootstrap files

### `mobile/package.json`

```json
{
  "name": "blinkone-mobile",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start":    "expo start",
    "android":  "expo start --android",
    "ios":      "expo start --ios",
    "build:apk": "eas build --platform android --profile preview",
    "type-check": "tsc --noEmit",
    "lint":     "eslint . --ext .ts,.tsx"
  },
  "dependencies": {
    "expo":                          "~51.0.0",
    "expo-router":                   "~3.5.0",
    "expo-splash-screen":            "~0.27.0",
    "expo-status-bar":               "~1.12.0",
    "expo-secure-store":             "~13.0.0",
    "expo-notifications":            "~0.28.0",
    "expo-av":                       "~14.0.0",
    "expo-font":                     "~12.0.0",
    "expo-linking":                  "~6.3.0",
    "expo-constants":                "~16.0.0",
    "expo-network":                  "~6.0.0",
    "expo-haptics":                  "~13.0.0",
    "react":                         "18.2.0",
    "react-native":                  "0.74.1",
    "react-native-webrtc":           "^118.0.0",
    "jssip":                         "^3.10.0",
    "react-native-actioncable":      "^1.0.3",
    "@tanstack/react-query":         "^5.28.0",
    "zustand":                       "^4.5.0",
    "nativewind":                    "^4.0.1",
    "react-native-safe-area-context": "4.10.1",
    "react-native-screens":          "~3.31.0",
    "@react-native-async-storage/async-storage": "1.23.1",
    "react-native-gesture-handler":  "~2.16.0",
    "react-native-reanimated":       "~3.10.0",
    "react-native-svg":              "15.2.0",
    "i18next":                       "^23.10.0",
    "react-i18next":                 "^14.1.0",
    "date-fns":                      "^3.6.0",
    "zod":                           "^3.22.0"
  },
  "devDependencies": {
    "@babel/core":                   "^7.24.0",
    "@types/react":                  "~18.2.0",
    "@types/react-native":           "~0.74.0",
    "typescript":                    "~5.3.0",
    "tailwindcss":                   "^3.4.0",
    "eslint":                        "^8.57.0"
  }
}
```

---

### `mobile/app.json`

```json
{
  "expo": {
    "name": "BlinkOne",
    "slug": "blinkone",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/images/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0f1117"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "ai.blinkone.app",
      "infoPlist": {
        "NSMicrophoneUsageDescription": "BlinkOne needs microphone access for voice calls.",
        "NSCameraUsageDescription": "BlinkOne needs camera access for video calls.",
        "UIBackgroundModes": ["audio", "voip", "remote-notification", "fetch"]
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#0f1117"
      },
      "package": "ai.blinkone.app",
      "permissions": [
        "RECORD_AUDIO",
        "CAMERA",
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "POST_NOTIFICATIONS"
      ]
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-font",
      [
        "expo-notifications",
        {
          "icon": "./assets/images/icon.png",
          "color": "#63b3ed",
          "sounds": ["./assets/sounds/ringtone.mp3"]
        }
      ],
      [
        "react-native-webrtc",
        {
          "cameraPermission": "Allow BlinkOne to use your camera for video calls",
          "microphonePermission": "Allow BlinkOne to use your microphone for voice calls"
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    },
    "scheme": "blinkone"
  }
}
```

---

### `mobile/.env`

```env
# BlinkOne Mobile — Expo public env vars (baked at build time)
# Replace with your laptop's local WiFi IP for demo (same network)

EXPO_PUBLIC_CHATWOOT_URL=http://192.168.1.50:3000
EXPO_PUBLIC_GATEWAY_URL=http://192.168.1.50:8080
EXPO_PUBLIC_WS_URL=ws://192.168.1.50:3000/cable
EXPO_PUBLIC_SIP_WSS=wss://192.168.1.50:8089
EXPO_PUBLIC_SIP_DOMAIN=blinkone.local
EXPO_PUBLIC_SIP_PASS=blinkone-agent-demo
EXPO_PUBLIC_STUN=stun:stun.l.google.com:19302

# Customer app settings
EXPO_PUBLIC_SUPPORT_QUEUE=support       # Asterisk queue key
EXPO_PUBLIC_SUPPORT_EXT=5000            # Extension customer calls
EXPO_PUBLIC_DEFAULT_LANG=ar            # ar or en
```

---

### `mobile/tsconfig.json`

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

### `mobile/babel.config.js`

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'nativewind/babel',
      'react-native-reanimated/plugin',
    ],
  };
};
```

---

### `mobile/metro.config.js`

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: './src/lib/global.css' });
```

---

### `mobile/tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand:    { DEFAULT: '#63b3ed', dark: '#3182ce' },
        surface:  { DEFAULT: '#1a1d26', card: '#22263a', border: 'rgba(255,255,255,0.08)' },
        bg:       { DEFAULT: '#0f1117' },
        success:  '#48bb78',
        warning:  '#f6ad55',
        danger:   '#fc8181',
        'text-primary':   '#e8eaf0',
        'text-secondary': '#9099aa',
        'text-muted':     '#5a6170',
      },
      fontFamily: {
        sans:    ['IBMPlexSans_400Regular',   'System'],
        medium:  ['IBMPlexSans_500Medium',    'System'],
        bold:    ['IBMPlexSans_700Bold',      'System'],
        arabic:  ['IBMPlexSansArabic_400Regular', 'System'],
      },
    },
  },
};
```

---

## PART 2 — Types (`src/types/index.ts`)

Mirror the web types exactly. Copy all interfaces from `frontend/src/types/index.ts`
verbatim. Add these mobile-specific additions:

```ts
// ─── Mobile-specific ──────────────────────────────────────────────────────────
export type AppRole = 'customer' | 'agent';

export interface CustomerSession {
  contactId?: number;        // null until contact created on first chat
  conversationId?: number;   // active conversation
  guestToken?: string;       // anonymous session token (future)
}

export interface IncomingCallInfo {
  callId:        string;
  callerName:    string;
  callerNumber:  string;
  queueKey?:     string;
  startedAt:     string;
}
```

---

## PART 3 — Environment accessors (`src/lib/env.ts`)

```ts
// src/lib/env.ts
// All EXPO_PUBLIC_* vars are available at runtime (baked at build time).

export const CHATWOOT_URL  = process.env.EXPO_PUBLIC_CHATWOOT_URL  ?? 'http://192.168.1.50:3000';
export const GATEWAY_URL   = process.env.EXPO_PUBLIC_GATEWAY_URL   ?? 'http://192.168.1.50:8080';
export const WS_URL        = process.env.EXPO_PUBLIC_WS_URL        ?? 'ws://192.168.1.50:3000/cable';
export const SIP_WSS       = process.env.EXPO_PUBLIC_SIP_WSS       ?? '';
export const SIP_DOMAIN    = process.env.EXPO_PUBLIC_SIP_DOMAIN    ?? 'blinkone.local';
export const SIP_PASS      = process.env.EXPO_PUBLIC_SIP_PASS      ?? '';
export const STUN          = process.env.EXPO_PUBLIC_STUN          ?? 'stun:stun.l.google.com:19302';
export const SUPPORT_EXT   = process.env.EXPO_PUBLIC_SUPPORT_EXT   ?? '5000';
export const SUPPORT_QUEUE = process.env.EXPO_PUBLIC_SUPPORT_QUEUE ?? 'support';
export const DEFAULT_LANG  = process.env.EXPO_PUBLIC_DEFAULT_LANG  ?? 'en';
```

---

## PART 4 — Secure storage (`src/lib/storage.ts`)

```ts
// src/lib/storage.ts
// Tokens → SecureStore (encrypted). Preferences → AsyncStorage (plain).

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'blinkone_tokens';
const PREFS_KEY = 'blinkone_prefs';

export interface StoredTokens {
  accessToken: string;
  gatewayJwt:  string;
}

export interface StoredPrefs {
  role:   'agent' | 'customer';
  lang:   'ar' | 'en';
  theme:  'dark' | 'light' | 'system';
}

// ── Tokens (SecureStore — AES encrypted) ──────────────────────────────────────
export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
}

export async function loadTokens(): Promise<StoredTokens | null> {
  try {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ── Preferences (AsyncStorage) ────────────────────────────────────────────────
export async function savePrefs(prefs: Partial<StoredPrefs>): Promise<void> {
  const current = await loadPrefs();
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
}

export async function loadPrefs(): Promise<StoredPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as StoredPrefs) : { role: 'agent', lang: 'en', theme: 'system' };
  } catch {
    return { role: 'agent', lang: 'en', theme: 'system' };
  }
}
```

---

## PART 5 — API client (`src/api/client.ts`)

```ts
// src/api/client.ts
// Identical logic to web client — no Next.js rewrites here, uses full URLs.

import { useAuthStore } from '@/store/auth';
import { CHATWOOT_URL, GATEWAY_URL } from '@/lib/env';

class BlinkoneApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = 'BlinkoneApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }
  let errBody: { code?: string; message?: string } = {};
  try { errBody = await res.json(); } catch { /* ignore */ }
  throw new BlinkoneApiError(
    errBody.code ?? 'HTTP_ERROR',
    errBody.message ?? `Request failed: ${res.status}`,
    res.status,
  );
}

export async function cwFetch<T>(
  path: string,
  init: RequestInit = {},
  version: 'v1' | 'v2' = 'v1',
): Promise<T> {
  const { tokens } = useAuthStore.getState();
  const url = `${CHATWOOT_URL}/api/${version}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(tokens?.accessToken ? { api_access_token: tokens.accessToken } : {}),
      ...(init.headers ?? {}),
    },
  });
  return handleResponse<T>(res);
}

export async function bnFetch<T>(
  service: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { tokens } = useAuthStore.getState();
  if (!tokens?.gatewayJwt) throw new BlinkoneApiError('NO_JWT', 'Not authenticated', 401);
  const url = `${GATEWAY_URL}/api/${service}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.gatewayJwt}`,
      ...(init.headers ?? {}),
    },
  });
  return handleResponse<T>(res);
}

export { BlinkoneApiError };
```

---

## PART 6 — Auth API (`src/api/auth.ts`)

```ts
// src/api/auth.ts
import { CHATWOOT_URL, GATEWAY_URL } from '@/lib/env';
import type { BlinkoneUser, AuthTokens } from '@/types';

function resolveRole(cwRole: string, email: string): BlinkoneUser['role'] {
  const platformAdmins = (process.env.EXPO_PUBLIC_PLATFORM_ADMINS ?? '').split(',');
  if (platformAdmins.includes(email)) return 'platform_admin';
  if (cwRole === 'administrator') return 'admin';
  if (cwRole === 'supervisor')    return 'supervisor';
  return 'agent';
}

export async function loginWithPassword(email: string, password: string): Promise<{
  user: BlinkoneUser;
  tokens: AuthTokens;
}> {
  // Step 1 — Chatwoot sign in
  const cwRes = await fetch(`${CHATWOOT_URL}/auth/sign_in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!cwRes.ok) {
    const err = await cwRes.json().catch(() => ({}));
    throw new Error(err?.error ?? 'Invalid email or password');
  }
  const cw = await cwRes.json();
  const cwToken: string = cw.data.access_token;

  // Step 2 — gateway JWT exchange
  const gwRes = await fetch(`${GATEWAY_URL}/api/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Access-Token': cwToken,
      api_access_token: cwToken,
    },
    body: '{}',
  });
  if (!gwRes.ok) {
    const err = await gwRes.json().catch(() => ({}));
    throw new Error(err?.message ?? 'Gateway authentication failed');
  }
  const gw = await gwRes.json();

  const user: BlinkoneUser = {
    id:                 cw.data.id,
    name:               cw.data.name,
    email:              cw.data.email,
    role:               resolveRole(cw.data.role, cw.data.email),
    tenantId:           String(cw.data.account_id),
    chatwootAccountId:  cw.data.account_id,
    avatarUrl:          cw.data.avatar_url,
  };

  return { user, tokens: { accessToken: cwToken, gatewayJwt: gw.token } };
}
```

---

## PART 7 — Auth store (`src/store/auth.ts`)

```ts
// src/store/auth.ts
// Tokens persist in SecureStore across app restarts (unlike web which is memory-only).

import { create } from 'zustand';
import { saveTokens, loadTokens, clearTokens } from '@/lib/storage';
import type { BlinkoneUser, AuthTokens } from '@/types';

interface AuthState {
  user:         BlinkoneUser | null;
  tokens:       AuthTokens | null;
  hydrated:     boolean;       // true once SecureStore has been read on startup
  setAuth:      (user: BlinkoneUser, tokens: AuthTokens) => Promise<void>;
  clearAuth:    () => Promise<void>;
  updateTokens: (tokens: AuthTokens) => Promise<void>;
  hydrate:      () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:     null,
  tokens:   null,
  hydrated: false,

  hydrate: async () => {
    const stored = await loadTokens();
    // We can't restore `user` without hitting the API again.
    // Just restore tokens — the login screen will re-validate on next open.
    // For seamless re-login, tokens alone are enough to make API calls.
    set({ tokens: stored, hydrated: true });
  },

  setAuth: async (user, tokens) => {
    await saveTokens(tokens);
    set({ user, tokens });
  },

  clearAuth: async () => {
    await clearTokens();
    set({ user: null, tokens: null });
  },

  updateTokens: async (tokens) => {
    await saveTokens(tokens);
    set((s) => ({ ...s, tokens }));
  },
}));
```

---

## PART 8 — Calls store (`src/store/calls.ts`)

```ts
// src/store/calls.ts
import { create } from 'zustand';
import type { CallSession, AgentState, IncomingCallInfo } from '@/types';

interface CallsState {
  activeCall:      CallSession | null;
  incomingCalls:   IncomingCallInfo[];
  agentState:      AgentState;
  isMuted:         boolean;
  isOnHold:        boolean;
  callDurationSec: number;

  setActiveCall:      (call: CallSession | null) => void;
  addIncomingCall:    (call: IncomingCallInfo)   => void;
  removeIncomingCall: (callId: string)           => void;
  setAgentState:      (state: AgentState)        => void;
  setMuted:           (v: boolean)               => void;
  setOnHold:          (v: boolean)               => void;
  setCallDuration:    (sec: number)              => void;
}

export const useCallsStore = create<CallsState>((set) => ({
  activeCall:      null,
  incomingCalls:   [],
  agentState:      'offline',
  isMuted:         false,
  isOnHold:        false,
  callDurationSec: 0,

  setActiveCall:      (call)   => set({ activeCall: call, isMuted: false, isOnHold: false, callDurationSec: 0 }),
  addIncomingCall:    (call)   => set((s) => ({ incomingCalls: [...s.incomingCalls, call] })),
  removeIncomingCall: (callId) => set((s) => ({ incomingCalls: s.incomingCalls.filter(c => c.callId !== callId) })),
  setAgentState:      (state)  => set({ agentState: state }),
  setMuted:           (v)      => set({ isMuted: v }),
  setOnHold:          (v)      => set({ isOnHold: v }),
  setCallDuration:    (sec)    => set({ callDurationSec: sec }),
}));
```

---

## PART 9 — i18n (`src/lib/i18n.ts`)

```ts
// src/lib/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import { DEFAULT_LANG } from './env';

const en = {
  translation: {
    // Auth
    'auth.login':           'Sign In',
    'auth.email':           'Email',
    'auth.password':        'Password',
    'auth.signing_in':      'Signing in…',
    'auth.invalid':         'Invalid email or password',
    'auth.welcome_back':    'Welcome back',
    'auth.blinkone':        'BlinkOne',

    // Customer home
    'customer.call_support':  'Call Support',
    'customer.start_chat':    'Start Chat',
    'customer.my_tickets':    'My Tickets',
    'customer.calling':       'Calling support…',
    'customer.connected':     'Connected',

    // Agent
    'agent.dashboard':        'Dashboard',
    'agent.conversations':    'Conversations',
    'agent.calls':            'Calls',
    'agent.settings':         'Settings',
    'agent.available':        'Available',
    'agent.busy':             'Busy',
    'agent.break':            'On Break',
    'agent.offline':          'Offline',
    'agent.queue_waiting':    '{{count}} waiting',
    'agent.incoming_call':    'Incoming Call',
    'agent.from':             'From',

    // Conversations
    'conv.open':              'Open',
    'conv.resolved':          'Resolved',
    'conv.pending':           'Pending',
    'conv.no_conversations':  'No conversations',
    'conv.type_message':      'Type a message…',
    'conv.send':              'Send',
    'conv.resolve':           'Resolve',
    'conv.reopen':            'Reopen',

    // Tickets
    'ticket.open':            'Open',
    'ticket.resolved':        'Resolved',
    'ticket.pending':         'Pending',
    'ticket.p1':              'Critical',
    'ticket.p2':              'High',
    'ticket.p3':              'Medium',
    'ticket.p4':              'Low',
    'ticket.no_tickets':      'No tickets yet',
    'ticket.new':             'New Ticket',
    'ticket.subject':         'Subject',
    'ticket.description':     'Description',

    // Call screen
    'call.answer':            'Answer',
    'call.decline':           'Decline',
    'call.end':               'End Call',
    'call.mute':              'Mute',
    'call.unmute':            'Unmute',
    'call.hold':              'Hold',
    'call.unhold':            'Resume',
    'call.speaker':           'Speaker',
    'call.dialpad':           'Keypad',

    // Common
    'common.loading':         'Loading…',
    'common.error':           'Something went wrong',
    'common.retry':           'Retry',
    'common.cancel':          'Cancel',
    'common.save':            'Save',
    'common.logout':          'Sign Out',
    'common.offline':         'You are offline',
    'common.back':            'Back',
    'common.search':          'Search',
    'common.no_results':      'No results',
  },
};

const ar = {
  translation: {
    // Auth
    'auth.login':           'تسجيل الدخول',
    'auth.email':           'البريد الإلكتروني',
    'auth.password':        'كلمة المرور',
    'auth.signing_in':      'جارٍ تسجيل الدخول…',
    'auth.invalid':         'البريد أو كلمة المرور غير صحيحة',
    'auth.welcome_back':    'مرحباً بعودتك',
    'auth.blinkone':        'BlinkOne',

    // Customer home
    'customer.call_support':  'اتصل بالدعم',
    'customer.start_chat':    'ابدأ محادثة',
    'customer.my_tickets':    'تذاكري',
    'customer.calling':       'جارٍ الاتصال بالدعم…',
    'customer.connected':     'متصل',

    // Agent
    'agent.dashboard':        'لوحة التحكم',
    'agent.conversations':    'المحادثات',
    'agent.calls':            'المكالمات',
    'agent.settings':         'الإعدادات',
    'agent.available':        'متاح',
    'agent.busy':             'مشغول',
    'agent.break':            'في استراحة',
    'agent.offline':          'غير متصل',
    'agent.queue_waiting':    '{{count}} في الانتظار',
    'agent.incoming_call':    'مكالمة واردة',
    'agent.from':             'من',

    // Conversations
    'conv.open':              'مفتوح',
    'conv.resolved':          'محلول',
    'conv.pending':           'معلق',
    'conv.no_conversations':  'لا توجد محادثات',
    'conv.type_message':      'اكتب رسالة…',
    'conv.send':              'إرسال',
    'conv.resolve':           'إغلاق',
    'conv.reopen':            'إعادة فتح',

    // Tickets
    'ticket.open':            'مفتوح',
    'ticket.resolved':        'محلول',
    'ticket.pending':         'معلق',
    'ticket.p1':              'حرج',
    'ticket.p2':              'عالي',
    'ticket.p3':              'متوسط',
    'ticket.p4':              'منخفض',
    'ticket.no_tickets':      'لا توجد تذاكر',
    'ticket.new':             'تذكرة جديدة',
    'ticket.subject':         'الموضوع',
    'ticket.description':     'التفاصيل',

    // Call screen
    'call.answer':            'رد',
    'call.decline':           'رفض',
    'call.end':               'إنهاء المكالمة',
    'call.mute':              'كتم الصوت',
    'call.unmute':            'تشغيل الصوت',
    'call.hold':              'تعليق',
    'call.unhold':            'استئناف',
    'call.speaker':           'مكبر الصوت',
    'call.dialpad':           'لوحة الأرقام',

    // Common
    'common.loading':         'جارٍ التحميل…',
    'common.error':           'حدث خطأ ما',
    'common.retry':           'إعادة المحاولة',
    'common.cancel':          'إلغاء',
    'common.save':            'حفظ',
    'common.logout':          'تسجيل الخروج',
    'common.offline':         'أنت غير متصل بالإنترنت',
    'common.back':            'رجوع',
    'common.search':          'بحث',
    'common.no_results':      'لا توجد نتائج',
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources:  { en, ar },
    lng:        DEFAULT_LANG,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

// Apply RTL layout for Arabic
export function applyRTL(lang: string) {
  const isRTL = lang === 'ar';
  I18nManager.forceRTL(isRTL);
  I18nManager.allowRTL(isRTL);
}

export default i18n;
```

---

## PART 10 — JsSIP hook (`src/hooks/useJsSip.ts`)

```ts
// src/hooks/useJsSip.ts
// React Native WebRTC + JsSIP. Uses react-native-webrtc for native media.

import { useEffect, useRef, useCallback } from 'react';
import { RTCPeerConnection, RTCSessionDescription, mediaDevices } from 'react-native-webrtc';
import { useCallsStore } from '@/store/calls';
import { useAuthStore } from '@/store/auth';
import { SIP_WSS, SIP_DOMAIN, SIP_PASS, STUN } from '@/lib/env';
import type { CallSession } from '@/types';

// Inject react-native-webrtc globals that JsSIP relies on
(global as Record<string, unknown>).RTCPeerConnection    = RTCPeerConnection;
(global as Record<string, unknown>).RTCSessionDescription = RTCSessionDescription;

interface SipUA {
  start(): void;
  stop(): void;
  call(target: string, options: unknown): SipSession;
  on(event: string, handler: (...args: unknown[]) => void): void;
  isRegistered(): boolean;
}

interface SipSession {
  answer(options?: unknown): void;
  terminate(): void;
  mute(options?: { audio: boolean }): void;
  unmute(options?: { audio: boolean }): void;
  hold(): Promise<void>;
  unhold(): Promise<void>;
  on(event: string, handler: (...args: unknown[]) => void): void;
}

export function useJsSip() {
  const uaRef      = useRef<SipUA | null>(null);
  const sessionRef = useRef<SipSession | null>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    setActiveCall, addIncomingCall, removeIncomingCall,
    setAgentState, setMuted, setOnHold, setCallDuration,
  } = useCallsStore();
  const { user, tokens } = useAuthStore();

  useEffect(() => {
    if (!SIP_WSS || !tokens?.gatewayJwt) return;

    (async () => {
      try {
        const JsSIP = await import('jssip');
        const sipUser = user?.email?.split('@')[0] ?? 'agent';
        const sipUri  = `sip:${sipUser}@${SIP_DOMAIN}`;

        const ua: SipUA = new (JsSIP as unknown as { UA: new (c: unknown) => SipUA }).UA({
          sockets: [new (JsSIP as unknown as {
            WebSocketInterface: new (url: string) => unknown
          }).WebSocketInterface(SIP_WSS)],
          uri:              sipUri,
          password:         SIP_PASS,
          display_name:     user?.name ?? sipUser,
          register:         true,
          register_expires: 120,
          session_timers:   false,
        });

        ua.on('registered',         () => setAgentState('available'));
        ua.on('unregistered',       () => setAgentState('offline'));
        ua.on('registrationFailed', () => setAgentState('offline'));

        ua.on('newRTCSession', (data: {
          session:    SipSession;
          originator: string;
          request?:   { from?: { display_name?: string; uri?: { user?: string } } };
        }) => {
          const { session, originator } = data;
          sessionRef.current = session;

          const callerNum  = data.request?.from?.uri?.user ?? 'unknown';
          const callerName = data.request?.from?.display_name ?? callerNum;

          if (originator === 'remote') {
            // Inbound call
            const incoming = {
              callId:       crypto.randomUUID(),
              callerName,
              callerNumber: callerNum,
              startedAt:    new Date().toISOString(),
            };
            addIncomingCall(incoming);

            session.on('ended', () => {
              removeIncomingCall(incoming.callId);
              sessionRef.current = null;
              setActiveCall(null);
              setAgentState('available');
              if (timerRef.current) clearInterval(timerRef.current);
            });

            session.on('failed', () => {
              removeIncomingCall(incoming.callId);
              sessionRef.current = null;
              setActiveCall(null);
              setAgentState('available');
            });
          }

          session.on('confirmed', () => {
            setAgentState('busy');
            // Start call duration timer
            let sec = 0;
            timerRef.current = setInterval(() => {
              sec++;
              setCallDuration(sec);
            }, 1000);

            const callSession: CallSession = {
              id:            crypto.randomUUID(),
              tenantId:      user?.tenantId ?? 'default',
              roomId:        crypto.randomUUID(),
              channel:       'voice',
              agentLabel:    user?.name ?? 'agent',
              customerPhone: callerNum,
              status:        'connected',
              transport:     'pstn',
              direction:     originator === 'remote' ? 'inbound' : 'outbound',
              startedAt:     new Date().toISOString(),
            };
            setActiveCall(callSession);
          });

          session.on('ended', () => {
            sessionRef.current = null;
            setActiveCall(null);
            setAgentState('available');
            setCallDuration(0);
            if (timerRef.current) clearInterval(timerRef.current);
          });
        });

        uaRef.current = ua;
        ua.start();
      } catch (err) {
        console.error('[JsSIP] init error', err);
      }
    })();

    return () => {
      uaRef.current?.stop();
      uaRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [tokens?.gatewayJwt, user?.email]);

  const makeCall = useCallback((destination: string) => {
    if (!uaRef.current?.isRegistered()) return;
    const target = destination.startsWith('sip:')
      ? destination
      : `sip:${destination}@${SIP_DOMAIN}`;
    sessionRef.current = uaRef.current.call(target, {
      mediaConstraints:    { audio: true, video: false },
      rtcOfferConstraints: { offerToReceiveAudio: true },
      pcConfig:            { iceServers: [{ urls: STUN }] },
    });
  }, []);

  const answerCall = useCallback(() => {
    sessionRef.current?.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig:         { iceServers: [{ urls: STUN }] },
    });
  }, []);

  const hangup = useCallback(() => {
    sessionRef.current?.terminate();
    sessionRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const mute   = useCallback(() => { sessionRef.current?.mute({ audio: true });   setMuted(true);  }, []);
  const unmute = useCallback(() => { sessionRef.current?.unmute({ audio: true }); setMuted(false); }, []);
  const hold   = useCallback(async () => { await sessionRef.current?.hold();   setOnHold(true);  }, []);
  const unhold = useCallback(async () => { await sessionRef.current?.unhold(); setOnHold(false); }, []);

  return { makeCall, answerCall, hangup, mute, unmute, hold, unhold };
}
```

---

## PART 11 — Root layout (`app/_layout.tsx`)

```tsx
// app/_layout.tsx
import '../src/lib/global.css';
import { useEffect } from 'react';
import { Stack }     from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts,
  IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans';
import { IBMPlexSansArabic_400Regular } from '@expo-google-fonts/ibm-plex-sans-arabic';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar }     from 'expo-status-bar';
import { useAuthStore }  from '@/store/auth';
import '../src/lib/i18n';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  const hydrate  = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_700Bold,
    IBMPlexSansArabic_400Regular,
  });

  useEffect(() => { hydrate(); }, []);

  useEffect(() => {
    if (fontsLoaded && hydrated) SplashScreen.hideAsync();
  }, [fontsLoaded, hydrated]);

  if (!fontsLoaded || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0f1117' } }}>
          <Stack.Screen name="(customer)"    />
          <Stack.Screen name="(agent)"       />
          <Stack.Screen name="auth"          />
          <Stack.Screen name="call-active"   options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="+not-found"    />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
```

---

## PART 12 — Role selector screen (`app/auth/select-role.tsx`)

First screen on fresh install. Customer needs no login. Agent must log in.

```tsx
// app/auth/select-role.tsx
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { savePrefs } from '@/lib/storage';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SelectRole() {
  const { t } = useTranslation();

  async function chooseCustomer() {
    await savePrefs({ role: 'customer' });
    router.replace('/(customer)');
  }

  async function chooseAgent() {
    await savePrefs({ role: 'agent' });
    router.replace('/auth/login');
  }

  return (
    <SafeAreaView className="flex-1 bg-bg items-center justify-center px-6">
      <Text className="text-brand text-3xl font-bold mb-2">BlinkOne</Text>
      <Text className="text-text-secondary text-sm mb-12">Contact Center Platform</Text>

      {/* Customer card */}
      <TouchableOpacity
        onPress={chooseCustomer}
        className="w-full bg-surface-card border border-surface-border rounded-2xl p-6 mb-4 active:opacity-70"
      >
        <Text className="text-4xl mb-3">📱</Text>
        <Text className="text-text-primary text-lg font-bold mb-1">I need support</Text>
        <Text className="text-text-secondary text-sm">Contact our team — call or chat anytime</Text>
      </TouchableOpacity>

      {/* Agent card */}
      <TouchableOpacity
        onPress={chooseAgent}
        className="w-full bg-surface-card border border-brand/30 rounded-2xl p-6 active:opacity-70"
      >
        <Text className="text-4xl mb-3">🎧</Text>
        <Text className="text-text-primary text-lg font-bold mb-1">I'm an agent</Text>
        <Text className="text-text-secondary text-sm">Sign in to handle conversations and calls</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
```

---

## PART 13 — Agent login (`app/auth/login.tsx`)

```tsx
// app/auth/login.tsx
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { router }          from 'expo-router';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useTranslation }  from 'react-i18next';
import { loginWithPassword } from '@/api/auth';
import { useAuthStore }      from '@/store/auth';

export default function LoginScreen() {
  const { t }   = useTranslation();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Please enter your email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { user, tokens } = await loginWithPassword(email.trim(), password);
      await setAuth(user, tokens);
      router.replace('/(agent)');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center px-6"
      >
        <Text className="text-brand text-3xl font-bold mb-1">BlinkOne</Text>
        <Text className="text-text-secondary text-sm mb-10">{t('auth.welcome_back')}</Text>

        {/* Email */}
        <Text className="text-text-secondary text-xs mb-1 uppercase tracking-widest">{t('auth.email')}</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="agent@company.com"
          placeholderTextColor="#5a6170"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          className="bg-surface-card border border-surface-border rounded-xl px-4 py-3.5 text-text-primary mb-4"
        />

        {/* Password */}
        <Text className="text-text-secondary text-xs mb-1 uppercase tracking-widest">{t('auth.password')}</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#5a6170"
          secureTextEntry
          className="bg-surface-card border border-surface-border rounded-xl px-4 py-3.5 text-text-primary mb-2"
          onSubmitEditing={handleLogin}
          returnKeyType="done"
        />

        {/* Error */}
        {!!error && (
          <Text className="text-danger text-sm mb-4">{error}</Text>
        )}

        {/* Submit */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          className="bg-brand rounded-xl py-4 items-center mt-2 active:opacity-80"
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text className="text-black font-bold text-base">{t('auth.login')}</Text>
          }
        </TouchableOpacity>

        {/* Back to role select */}
        <TouchableOpacity onPress={() => router.replace('/auth/select-role')} className="mt-6 items-center">
          <Text className="text-text-muted text-sm">← Back</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

---

## PART 14 — Customer home (`app/(customer)/index.tsx`)

```tsx
// app/(customer)/index.tsx
'use client';
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router }           from 'expo-router';
import { SafeAreaView }     from 'react-native-safe-area-context';
import { useTranslation }   from 'react-i18next';
import * as Haptics         from 'expo-haptics';
import { useJsSip }         from '@/hooks/useJsSip';
import { useCallsStore }    from '@/store/calls';
import { SUPPORT_EXT }      from '@/lib/env';
import { usePermissions }   from '@/hooks/usePermissions';
import { ActiveCallBar }    from '@/components/calling/ActiveCallBar';
import { IncomingCallSheet } from '@/components/calling/IncomingCallSheet';

export default function CustomerHome() {
  const { t }            = useTranslation();
  const { makeCall }     = useJsSip();
  const activeCall       = useCallsStore((s) => s.activeCall);
  const incomingCalls    = useCallsStore((s) => s.incomingCalls);
  const { requestMic }   = usePermissions();
  const [calling, setCalling] = useState(false);

  async function handleCallSupport() {
    const granted = await requestMic();
    if (!granted) {
      Alert.alert('Microphone Required', 'Please grant microphone permission to make calls.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCalling(true);
    makeCall(SUPPORT_EXT);
  }

  // Navigate to active call screen when call is connected
  useEffect(() => {
    if (activeCall) router.push('/call-active');
    else setCalling(false);
  }, [activeCall]);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingTop: 24, paddingBottom: 40 }}>

        {/* Header */}
        <View className="mb-8">
          <Text className="text-brand text-2xl font-bold">BlinkOne</Text>
          <Text className="text-text-secondary text-sm mt-1">How can we help you today?</Text>
        </View>

        {/* Call Support — primary action */}
        <TouchableOpacity
          onPress={handleCallSupport}
          disabled={calling}
          className="bg-success rounded-2xl p-6 mb-4 items-center active:opacity-80"
        >
          <Text className="text-5xl mb-3">📞</Text>
          <Text className="text-black text-xl font-bold">
            {calling ? t('customer.calling') : t('customer.call_support')}
          </Text>
          <Text className="text-black/60 text-sm mt-1">
            {calling ? 'Connecting you to an agent…' : 'Talk to us right now'}
          </Text>
        </TouchableOpacity>

        {/* Chat */}
        <TouchableOpacity
          onPress={() => router.push('/(customer)/chat/new')}
          className="bg-surface-card border border-surface-border rounded-2xl p-5 mb-4 flex-row items-center active:opacity-70"
        >
          <Text className="text-3xl mr-4">💬</Text>
          <View className="flex-1">
            <Text className="text-text-primary font-bold text-base">{t('customer.start_chat')}</Text>
            <Text className="text-text-secondary text-sm mt-0.5">Send us a message anytime</Text>
          </View>
          <Text className="text-text-muted text-lg">›</Text>
        </TouchableOpacity>

        {/* Tickets */}
        <TouchableOpacity
          onPress={() => router.push('/(customer)/tickets')}
          className="bg-surface-card border border-surface-border rounded-2xl p-5 flex-row items-center active:opacity-70"
        >
          <Text className="text-3xl mr-4">🎫</Text>
          <View className="flex-1">
            <Text className="text-text-primary font-bold text-base">{t('customer.my_tickets')}</Text>
            <Text className="text-text-secondary text-sm mt-0.5">Track your support requests</Text>
          </View>
          <Text className="text-text-muted text-lg">›</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Active call mini bar */}
      {activeCall && <ActiveCallBar />}

      {/* Incoming call sheet */}
      {incomingCalls.length > 0 && <IncomingCallSheet />}
    </SafeAreaView>
  );
}
```

---

## PART 15 — Agent dashboard (`app/(agent)/index.tsx`)

```tsx
// app/(agent)/index.tsx
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router }           from 'expo-router';
import { SafeAreaView }     from 'react-native-safe-area-context';
import { useTranslation }   from 'react-i18next';
import { useQuery }         from '@tanstack/react-query';
import { useAuthStore }     from '@/store/auth';
import { useCallsStore }    from '@/store/calls';
import { useJsSip }         from '@/hooks/useJsSip';
import { setAgentState as apiSetAgentState } from '@/api/routing';
import { IncomingCallSheet }  from '@/components/calling/IncomingCallSheet';
import { ActiveCallBar }      from '@/components/calling/ActiveCallBar';
import { Avatar }             from '@/components/layout/Avatar';
import { Skeleton }           from '@/components/ui/Skeleton';
import { OfflineBanner }      from '@/components/layout/OfflineBanner';
import type { AgentState }    from '@/types';

const STATE_OPTIONS: { key: AgentState; label: string; color: string }[] = [
  { key: 'available', label: 'agent.available', color: '#48bb78' },
  { key: 'break',     label: 'agent.break',     color: '#f6ad55' },
  { key: 'busy',      label: 'agent.busy',      color: '#fc8181' },
  { key: 'offline',   label: 'agent.offline',   color: '#5a6170' },
];

export default function AgentDashboard() {
  const { t }          = useTranslation();
  const user           = useAuthStore((s) => s.user);
  const agentState     = useCallsStore((s) => s.agentState);
  const setAgentState  = useCallsStore((s) => s.setAgentState);
  const incomingCalls  = useCallsStore((s) => s.incomingCalls);
  const activeCall     = useCallsStore((s) => s.activeCall);
  const { makeCall }   = useJsSip();   // registers agent on mount

  async function handleStateChange(state: AgentState) {
    setAgentState(state);
    try {
      if (user) await apiSetAgentState(String(user.id), state);
    } catch { /* state updated locally even if API fails */ }
  }

  const stateInfo = STATE_OPTIONS.find(s => s.key === agentState) ?? STATE_OPTIONS[3];

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <OfflineBanner />
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
      >
        {/* Agent header */}
        <View className="flex-row items-center mb-6">
          <Avatar name={user?.name ?? ''} imageUrl={user?.avatarUrl} size={44} />
          <View className="ml-3 flex-1">
            <Text className="text-text-primary font-bold text-base">{user?.name}</Text>
            <Text className="text-text-secondary text-sm">{user?.email}</Text>
          </View>
          <View className="flex-row items-center gap-1.5 bg-surface-card border border-surface-border rounded-full px-3 py-1.5">
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: stateInfo.color }} />
            <Text className="text-text-primary text-xs font-medium">{t(stateInfo.label)}</Text>
          </View>
        </View>

        {/* State selector */}
        <Text className="text-text-muted text-xs uppercase tracking-widest mb-2">My Status</Text>
        <View className="flex-row gap-2 mb-6 flex-wrap">
          {STATE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => handleStateChange(opt.key)}
              className={`flex-row items-center gap-1.5 px-3 py-2 rounded-full border ${
                agentState === opt.key
                  ? 'border-transparent bg-surface'
                  : 'border-surface-border bg-transparent'
              }`}
            >
              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
              <Text className={`text-xs font-medium ${agentState === opt.key ? 'text-text-primary' : 'text-text-muted'}`}>
                {t(opt.label)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick nav */}
        <Text className="text-text-muted text-xs uppercase tracking-widest mb-2">Quick Access</Text>
        <View className="gap-3 mb-6">
          {[
            { icon: '💬', label: 'Conversations', route: '/(agent)/conversations' },
            { icon: '📋', label: 'Call History',  route: '/(agent)/calls' },
            { icon: '⚙️', label: 'Settings',      route: '/(agent)/settings' },
          ].map(item => (
            <TouchableOpacity
              key={item.route}
              onPress={() => router.push(item.route as never)}
              className="flex-row items-center bg-surface-card border border-surface-border rounded-xl p-4 active:opacity-70"
            >
              <Text className="text-2xl mr-4">{item.icon}</Text>
              <Text className="text-text-primary font-medium flex-1">{item.label}</Text>
              <Text className="text-text-muted">›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {activeCall    && <ActiveCallBar />}
      {incomingCalls.length > 0 && <IncomingCallSheet />}
    </SafeAreaView>
  );
}
```

---

## PART 16 — Active call screen (`app/call-active.tsx`)

Full-screen during a live call. Works for both Customer and Agent.

```tsx
// app/call-active.tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { router }          from 'expo-router';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useTranslation }  from 'react-i18next';
import { useCallsStore }   from '@/store/calls';
import { useJsSip }        from '@/hooks/useJsSip';
import * as Haptics        from 'expo-haptics';
import { useEffect }       from 'react';
import { formatDuration }  from 'date-fns';

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function CallActiveScreen() {
  const { t }           = useTranslation();
  const activeCall      = useCallsStore((s) => s.activeCall);
  const isMuted         = useCallsStore((s) => s.isMuted);
  const isOnHold        = useCallsStore((s) => s.isOnHold);
  const callDurationSec = useCallsStore((s) => s.callDurationSec);
  const { hangup, mute, unmute, hold, unhold } = useJsSip();

  // Go back when call ends
  useEffect(() => {
    if (!activeCall) router.back();
  }, [activeCall]);

  async function handleEndCall() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    hangup();
    router.back();
  }

  function handleMute() {
    Haptics.selectionAsync();
    if (isMuted) unmute(); else mute();
  }

  async function handleHold() {
    Haptics.selectionAsync();
    if (isOnHold) await unhold(); else await hold();
  }

  return (
    <SafeAreaView className="flex-1 bg-bg items-center justify-between py-10 px-6">
      {/* Caller info */}
      <View className="items-center mt-8">
        <View className="w-24 h-24 rounded-full bg-surface-card border-2 border-brand items-center justify-center mb-6">
          <Text className="text-5xl">
            {activeCall?.direction === 'inbound' ? '📲' : '📞'}
          </Text>
        </View>
        <Text className="text-text-primary text-2xl font-bold">
          {activeCall?.customerPhone ?? 'Unknown'}
        </Text>
        <Text className="text-success text-base mt-2">
          {isOnHold ? '⏸ On Hold' : `● ${formatSec(callDurationSec)}`}
        </Text>
      </View>

      {/* Call controls */}
      <View className="w-full">
        {/* Top row: mute + hold + speaker */}
        <View className="flex-row justify-around mb-8">
          {[
            { icon: isMuted ? '🔇' : '🎤', label: isMuted ? t('call.unmute') : t('call.mute'),   onPress: handleMute  },
            { icon: isOnHold ? '▶️' : '⏸',  label: isOnHold ? t('call.unhold') : t('call.hold'), onPress: handleHold  },
            { icon: '🔊',                    label: t('call.speaker'),                              onPress: () => {}   },
          ].map(ctrl => (
            <TouchableOpacity
              key={ctrl.label}
              onPress={ctrl.onPress}
              className="items-center"
            >
              <View className="w-16 h-16 rounded-full bg-surface-card border border-surface-border items-center justify-center mb-2">
                <Text className="text-2xl">{ctrl.icon}</Text>
              </View>
              <Text className="text-text-muted text-xs">{ctrl.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* End call */}
        <TouchableOpacity
          onPress={handleEndCall}
          className="bg-danger rounded-full py-5 items-center active:opacity-80"
        >
          <Text className="text-white font-bold text-lg">📵 {t('call.end')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
```

---

## PART 17 — IncomingCallSheet component

```tsx
// src/components/calling/IncomingCallSheet.tsx
import { View, Text, TouchableOpacity, Vibration } from 'react-native';
import { useEffect }        from 'react';
import { router }           from 'expo-router';
import { useTranslation }   from 'react-i18next';
import * as Haptics         from 'expo-haptics';
import { useCallsStore }    from '@/store/calls';
import { useJsSip }         from '@/hooks/useJsSip';
import { usePermissions }   from '@/hooks/usePermissions';

export function IncomingCallSheet() {
  const { t }             = useTranslation();
  const incomingCalls     = useCallsStore((s) => s.incomingCalls);
  const removeIncomingCall = useCallsStore((s) => s.removeIncomingCall);
  const { answerCall, hangup } = useJsSip();
  const { requestMic }    = usePermissions();

  const call = incomingCalls[0]; // show first incoming call

  useEffect(() => {
    if (!call) return;
    // Pulse vibrate pattern for ringtone effect
    const pattern = [0, 500, 300, 500];
    Vibration.vibrate(pattern, true);
    return () => Vibration.cancel();
  }, [call?.callId]);

  if (!call) return null;

  async function handleAnswer() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Vibration.cancel();
    const granted = await requestMic();
    if (!granted) return;
    answerCall();
    router.push('/call-active');
  }

  function handleDecline() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Vibration.cancel();
    hangup();
    removeIncomingCall(call.callId);
  }

  return (
    <View className="absolute bottom-0 left-0 right-0 bg-surface-card border-t border-surface-border rounded-t-3xl px-6 py-6 shadow-2xl">
      <Text className="text-text-muted text-xs text-center mb-1 uppercase tracking-widest">
        {t('agent.incoming_call')}
      </Text>
      <Text className="text-text-primary text-xl font-bold text-center mb-0.5">
        {call.callerName}
      </Text>
      <Text className="text-text-secondary text-sm text-center mb-6">
        {call.callerNumber}
      </Text>

      <View className="flex-row gap-4">
        <TouchableOpacity
          onPress={handleDecline}
          className="flex-1 bg-danger/20 border border-danger/40 rounded-2xl py-4 items-center active:opacity-70"
        >
          <Text className="text-2xl mb-1">📵</Text>
          <Text className="text-danger font-semibold">{t('call.decline')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleAnswer}
          className="flex-1 bg-success rounded-2xl py-4 items-center active:opacity-70"
        >
          <Text className="text-2xl mb-1">📞</Text>
          <Text className="text-black font-bold">{t('call.answer')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

---

## PART 18 — ActiveCallBar component

Persistent mini-bar shown while on a call, so user can browse other screens.

```tsx
// src/components/calling/ActiveCallBar.tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { router }         from 'expo-router';
import { useCallsStore }  from '@/store/calls';
import { useJsSip }       from '@/hooks/useJsSip';

function formatSec(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function ActiveCallBar() {
  const activeCall      = useCallsStore((s) => s.activeCall);
  const callDurationSec = useCallsStore((s) => s.callDurationSec);
  const { hangup }      = useJsSip();

  if (!activeCall) return null;

  return (
    <TouchableOpacity
      onPress={() => router.push('/call-active')}
      className="absolute top-0 left-0 right-0 bg-success flex-row items-center px-4 py-2 z-50"
    >
      <Text className="text-black text-lg mr-2">📞</Text>
      <View className="flex-1">
        <Text className="text-black font-bold text-xs">Active Call</Text>
        <Text className="text-black/70 text-xs">{activeCall.customerPhone}</Text>
      </View>
      <Text className="text-black font-mono text-sm mr-4">{formatSec(callDurationSec)}</Text>
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation(); hangup(); }}
        className="bg-black/20 rounded-full px-3 py-1"
      >
        <Text className="text-black text-xs font-bold">End</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
```

---

## PART 19 — Permissions hook (`src/hooks/usePermissions.ts`)

```ts
// src/hooks/usePermissions.ts
import { Audio }          from 'expo-av';
import * as Notifications from 'expo-notifications';

export function usePermissions() {
  async function requestMic(): Promise<boolean> {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  }

  async function requestNotifications(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  return { requestMic, requestNotifications };
}
```

---

## PART 20 — OfflineBanner component

```tsx
// src/components/layout/OfflineBanner.tsx
import { View, Text } from 'react-native';
import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    async function check() {
      const state = await Network.getNetworkStateAsync();
      setOffline(!state.isConnected);
    }
    check();
    interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!offline) return null;

  return (
    <View className="bg-warning/90 px-4 py-2 flex-row items-center justify-center">
      <Text className="text-black text-xs font-semibold">⚠️ You are offline — some features may be unavailable</Text>
    </View>
  );
}
```

---

## PART 21 — Agent conversations list (`app/(agent)/conversations/index.tsx`)

```tsx
// app/(agent)/conversations/index.tsx
import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { router }          from 'expo-router';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useTranslation }  from 'react-i18next';
import { useQuery }        from '@tanstack/react-query';
import { listConversations } from '@/api/conversations';
import { ConversationCard }  from '@/components/conversations/ConversationCard';
import { Skeleton }          from '@/components/ui/Skeleton';
import { EmptyState }        from '@/components/layout/EmptyState';
import { useState }          from 'react';

type StatusFilter = 'open' | 'resolved' | 'pending';

export default function AgentConversations() {
  const { t }     = useTranslation();
  const [status, setStatus] = useState<StatusFilter>('open');
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey:  ['conversations', status],
    queryFn:   () => listConversations({ status }),
    staleTime: 15_000,
  });

  const conversations = (data?.data ?? []).filter(c =>
    !search || c.meta.sender.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SafeAreaView className="flex-1 bg-bg">
      {/* Header */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-text-primary text-xl font-bold mb-3">{t('agent.conversations')}</Text>

        {/* Search */}
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('common.search')}
          placeholderTextColor="#5a6170"
          className="bg-surface-card border border-surface-border rounded-xl px-4 py-2.5 text-text-primary mb-3"
        />

        {/* Status filter tabs */}
        <View className="flex-row gap-2">
          {(['open','pending','resolved'] as StatusFilter[]).map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => setStatus(s)}
              className={`px-4 py-1.5 rounded-full border ${
                status === s
                  ? 'bg-brand border-brand'
                  : 'border-surface-border bg-transparent'
              }`}
            >
              <Text className={`text-xs font-medium capitalize ${status === s ? 'text-black' : 'text-text-secondary'}`}>
                {t(`conv.${s}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <View className="px-5 gap-3 mt-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </View>
      ) : conversations.length === 0 ? (
        <EmptyState icon="💬" message={t('conv.no_conversations')} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <ConversationCard
              conversation={item}
              onPress={() => router.push(`/(agent)/conversations/${item.id}` as never)}
            />
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#63b3ed" />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
        />
      )}
    </SafeAreaView>
  );
}
```

---

## PART 22 — Remaining components (implement all of these)

### `src/components/conversations/ConversationCard.tsx`
Display: sender avatar (Avatar component), sender name, last message preview truncated to 1 line, unread count badge (Badge component), relative timestamp (date-fns formatDistanceToNow), status badge. Tap navigates to conversation detail.

### `src/components/layout/Avatar.tsx`
Props: `name: string`, `imageUrl?: string`, `size?: number`, `online?: boolean`.
Show initials (first 2 chars) on colored background if no image. Show green dot if `online=true`.

### `src/components/ui/Skeleton.tsx`
Animated shimmer using Reanimated Animated.Value cycling opacity 0.3→0.7.
Props: `className?: string` (NativeWind for sizing).

### `src/components/ui/Button.tsx`
Props: `variant: 'primary'|'secondary'|'ghost'|'danger'`, `size: 'sm'|'md'|'lg'`, `loading?: boolean`, `disabled?: boolean`, `onPress`, `children`.
Shows ActivityIndicator when `loading=true`. Applies correct NativeWind classes per variant.

### `src/components/layout/EmptyState.tsx`
Props: `icon: string`, `message: string`, `actionLabel?: string`, `onAction?: () => void`.
Centered layout: large emoji, text, optional CTA button.

### `app/(agent)/conversations/[id].tsx`
Full conversation detail:
- AppHeader with back button + contact name + Resolve/Reopen button
- FlatList of MessageBubble components (inverted for chat style)
- MessageInput at bottom with send button
- useMessages hook for TanStack Query + optimistic updates
- useActionCable subscribeToConversation for real-time new messages

### `app/(customer)/chat/[id].tsx`
Same as agent conversation detail but simplified — no resolve button, no assign, no private notes.

### `app/(agent)/settings.tsx`
- Agent profile section: name, email, avatar, role badge
- Status toggle (same as dashboard)
- Language selector: Arabic / English (calls applyRTL + i18n.changeLanguage)
- SIP registration status: show if JsSIP is registered or not
- Sign out button → clearAuth → router.replace('/auth/select-role')

### `app/(agent)/calls/index.tsx`
- Call history list from listCDR() API
- Each item: direction icon (inbound/outbound), phone number, duration, outcome badge, timestamp
- Pull to refresh

### `src/hooks/useMessages.ts`
```ts
// TanStack Query + optimistic send
// queryKey: ['messages', conversationId]
// queryFn: getMessages(conversationId)
// mutation: sendMessage with optimistic update
// On mutation: add fake message immediately, invalidate on settle
```

### `src/hooks/useConversations.ts`
```ts
// useInfiniteQuery on listConversations
// returns flatList-ready pages, fetchNextPage, hasNextPage
```

### `src/hooks/useActionCable.ts`
```ts
// Wraps subscribeToConversation from api/websocket.ts
// Re-exports as React hook with useEffect cleanup
// Uses react-native-actioncable instead of actioncable package
```

---

## PART 23 — `app/index.tsx` — entry point (role redirect)

```tsx
// app/index.tsx
// Redirect to correct role screen based on stored preference.
import { useEffect }    from 'react';
import { router }       from 'expo-router';
import { loadPrefs }    from '@/lib/storage';
import { useAuthStore } from '@/store/auth';
import { View }         from 'react-native';

export default function EntryPoint() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const tokens   = useAuthStore((s) => s.tokens);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      const prefs = await loadPrefs();
      if (prefs.role === 'customer') {
        router.replace('/(customer)');
      } else if (tokens?.accessToken) {
        router.replace('/(agent)');
      } else {
        router.replace('/auth/select-role');
      }
    })();
  }, [hydrated]);

  return <View className="flex-1 bg-bg" />;
}
```

---

## PART 24 — `src/lib/global.css` (NativeWind base)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## VERIFICATION STEPS

After Cursor applies all changes:

```bash
cd mobile

# 1. Install dependencies
npm install

# 2. Type check — must be 0 errors
npm run type-check

# 3. Start Expo dev server
npx expo start

# 4. Install Expo Go on both Android phones from Play Store
#    https://play.google.com/store/apps/details?id=host.exp.exponent

# 5. Scan the QR code shown in terminal with Expo Go on each phone

# 6. On client's phone — choose "I need support" → tap "Call Support"
# 7. On your phone — choose "I'm an agent" → login → see incoming call ring

# ── Build APK (optional, after demo) ──
npm install -g eas-cli
eas login
eas build --platform android --profile preview
# Download APK → install on phones directly (no Play Store needed)
```

---

## SUMMARY OF ALL FILES TO CREATE

| File | Description |
|------|-------------|
| `mobile/package.json` | Dependencies |
| `mobile/app.json` | Expo config with permissions |
| `mobile/.env` | EXPO_PUBLIC_* env vars |
| `mobile/tsconfig.json` | TypeScript + path aliases |
| `mobile/babel.config.js` | Babel + NativeWind |
| `mobile/metro.config.js` | Metro + NativeWind |
| `mobile/tailwind.config.js` | Theme tokens |
| `mobile/src/types/index.ts` | All shared types |
| `mobile/src/lib/env.ts` | Env accessors |
| `mobile/src/lib/storage.ts` | SecureStore + AsyncStorage |
| `mobile/src/lib/i18n.ts` | English + Arabic translations |
| `mobile/src/lib/global.css` | NativeWind base |
| `mobile/src/api/client.ts` | cwFetch + bnFetch |
| `mobile/src/api/auth.ts` | loginWithPassword |
| `mobile/src/api/conversations.ts` | Conversations API |
| `mobile/src/api/calls.ts` | Calls API |
| `mobile/src/api/tickets.ts` | Tickets API |
| `mobile/src/api/routing.ts` | Agent state API |
| `mobile/src/store/auth.ts` | Auth store (SecureStore backed) |
| `mobile/src/store/calls.ts` | Calls store |
| `mobile/src/hooks/useJsSip.ts` | WebRTC calling hook |
| `mobile/src/hooks/usePermissions.ts` | Mic + notification permissions |
| `mobile/src/hooks/useMessages.ts` | Messages query + optimistic send |
| `mobile/src/hooks/useConversations.ts` | Conversations infinite query |
| `mobile/src/hooks/useActionCable.ts` | Real-time WebSocket hook |
| `mobile/app/_layout.tsx` | Root layout |
| `mobile/app/index.tsx` | Entry redirect |
| `mobile/app/call-active.tsx` | Full-screen call UI |
| `mobile/app/auth/select-role.tsx` | First launch role picker |
| `mobile/app/auth/login.tsx` | Agent login |
| `mobile/app/(customer)/_layout.tsx` | Customer tab layout |
| `mobile/app/(customer)/index.tsx` | Customer home |
| `mobile/app/(customer)/chat/[id].tsx` | Customer chat |
| `mobile/app/(customer)/tickets/index.tsx` | Customer ticket list |
| `mobile/app/(customer)/tickets/[id].tsx` | Customer ticket detail |
| `mobile/app/(agent)/_layout.tsx` | Agent tab layout |
| `mobile/app/(agent)/index.tsx` | Agent dashboard |
| `mobile/app/(agent)/conversations/index.tsx` | Agent conversations list |
| `mobile/app/(agent)/conversations/[id].tsx` | Conversation detail |
| `mobile/app/(agent)/calls/index.tsx` | Call history |
| `mobile/app/(agent)/settings.tsx` | Agent settings |
| `mobile/src/components/calling/IncomingCallSheet.tsx` | Incoming call bottom sheet |
| `mobile/src/components/calling/ActiveCallBar.tsx` | Mini call bar |
| `mobile/src/components/calling/DialPad.tsx` | DTMF keypad |
| `mobile/src/components/chat/MessageBubble.tsx` | Chat bubble |
| `mobile/src/components/chat/MessageInput.tsx` | Chat input |
| `mobile/src/components/chat/TypingIndicator.tsx` | Typing dots |
| `mobile/src/components/conversations/ConversationCard.tsx` | List item |
| `mobile/src/components/conversations/StatusBadge.tsx` | Status pill |
| `mobile/src/components/tickets/TicketCard.tsx` | Ticket list item |
| `mobile/src/components/tickets/PriorityBadge.tsx` | P1–P4 badge |
| `mobile/src/components/layout/AppHeader.tsx` | Screen header |
| `mobile/src/components/layout/Avatar.tsx` | Avatar with initials |
| `mobile/src/components/layout/EmptyState.tsx` | Empty state |
| `mobile/src/components/layout/OfflineBanner.tsx` | Offline notice |
| `mobile/src/components/layout/ErrorBoundary.tsx` | Error boundary |
| `mobile/src/components/ui/Button.tsx` | Reusable button |
| `mobile/src/components/ui/Badge.tsx` | Notification badge |
| `mobile/src/components/ui/Skeleton.tsx` | Loading skeleton |
| `mobile/src/components/ui/Toast.tsx` | In-app toast |
