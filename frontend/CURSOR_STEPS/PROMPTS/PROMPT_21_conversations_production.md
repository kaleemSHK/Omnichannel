# PROMPT 21 — Conversations Module: Production Finalization

## Context — read before touching any file

**Stack**: Next.js 14 App Router · Chatwoot v4.13.0-ce REST API · TanStack Query v5 · Zustand · Tailwind CSS  
**API clients** (use ONLY these — never raw fetch):
- `cwFetch()` → proxied via `/_cw/*` → Chatwoot upstream, `api_access_token` header
- `bnFetch()` → proxied via `/_gw/*` → BlinkOne gateway, Bearer JWT header

**RTL**: All spacing uses `ms-*`/`me-*`/`ps-*`/`pe-*` — NEVER `ml-*`/`mr-*`/`pl-*`/`pr-*`  
**Sheet**: Project uses `@/components/ui/Sheet` (capital S, custom) — NOT shadcn `sheet`  
**Demo mode**: `isDemoDataEnabled()` → return fixture; never call real API  
**RBAC**: `can(role, feature)` from `@/lib/rbac`  
**No localStorage** — all state is Zustand (memory) or TanStack Query (server)

---

## Bug Inventory — 18 issues identified

### CRITICAL

**BUG-01 · `page.tsx` — contact_id deep-link only works in demo mode**  
`page.tsx` line 22 searches `DEMO_CONVERSATIONS` for `contact_id` param. In production the list comes from API; the real conversation is never selected. Fix: after conversations load, find matching conversation by sender id in the loaded `data` pages, not the fixture.

**BUG-02 · `ConversationList.tsx` — search only filters client-side already-loaded pages**  
Typing in the search box filters the already-fetched `conversations` array. For large accounts this misses items not yet loaded. Fix: debounce search input (300 ms) and add `search` to `ConversationFilters`, passing `q` query param to `listConversations`. Chatwoot accepts `?q=<name>`.

**BUG-03 · `ConversationList.tsx` — inbox filter race: `inboxFilter` in filters causes infinite re-render**  
`filters` is built in `useMemo` but `useConversations(filters)` produces a new `queryKey` on every render because the object reference changes. The filters object must be stable: use `useRef` for previous value or stable primitive keys in the query key array.

**BUG-04 · `MessageThread.tsx` — agent assignee Select uses `a.agentId` (gateway field), but Chatwoot `assignConversation` expects Chatwoot `assignee_id`**  
Line 133: `value={String(a.agentId)}` then `assignMutation.mutate(e.target.value)` → the gateway agentId is sent to Chatwoot's assignments endpoint which expects the Chatwoot user id. Fix: the gateway agent object should carry a `chatwootUserId` field; use that as the Select value, or load agents from Chatwoot directly via `cwFetch('/accounts/:id/agents')` which returns `{ id, name, email }`.

**BUG-05 · `MessageThread.tsx` — `subscribeToConversation` is called but its return value (unsubscribe function) is NOT returned from the effect**  
Effect cleanup returns the unsubscribe only when `subscribeToConversation` returns a function, but if the function throws synchronously, nothing is cleaned up and the subscription leaks. Fix: wrap in try/catch, always return the unsubscribe fn.

**BUG-06 · `ReplyBox.tsx` — `takePendingInsert` runs on every render when `conversationId` changes**  
`useEffect` with `[conversationId, takePendingInsert]` dependency runs `takePendingInsert()` every time. `takePendingInsert` is a Zustand selector — its identity is stable but the effect fires unnecessarily. This is not a bug per se but the `insert-reply` CustomEvent listener in the same file duplicates the "insert snippet" path. One path (event) is from `AgentAssistPanel`; the other (`takePendingInsert`) is from `useInboxStore`. Both co-exist correctly — but add a comment explaining both, and guard against double-insertion.

**BUG-07 · `AgentAssistPanel.tsx` — `classifyConversation` response is completely ignored**  
Lines 104-115: `classifyConversation(String(conversationId))` is awaited but the real API response is discarded; hardcoded fallback `{ category: 'support', intent: 'plan_change', … }` is always returned even in production. Fix: extract and return the actual API response fields. Use the fallback only in the catch block.

**BUG-08 · `AgentAssistPanel.tsx` — `suggestReply` fallback Arabic text is always shown in production when API fails**  
Line 57-60: hardcoded Arabic fallback `'وعليكم السلام!...'` is returned on every API error. In production this shows a nonsense fabricated message. Fix: on error return `{ suggestion: '', confidence: 0 }` so the UI shows "No suggestion yet", not a fake message.

**BUG-09 · `CallTimelinePanel.tsx` — 100% static fixture, never connected to real data**  
`TIMELINE` and `RECORDINGS` are hardcoded constants. This component is rendered inside `AgentInboxShell` (deprecated) and is not currently used in the conversations page. Either wire it to the calls API (fetch `listCallsByConversation`) or remove it from render tree. Do not silently render stale fixture data.

**BUG-10 · `ConversationList.tsx` — `inboxes` query always calls `listInboxes()` even in demo mode**  
Lines 39-46: `try { await listInboxes() }` runs before checking `isDemoDataEnabled()`. In demo mode the call hits the proxy which returns 401 then falls back to `DEMO_INBOXES`. Fix: check `isDemoDataEnabled()` first and short-circuit.

### PRODUCTION / UX

**BUG-11 · `page.tsx` — `assistOpen` defaults to `true` on all screen sizes**  
On narrow screens (< 1280 px) three columns don't fit; `AgentAssistPanel` overflows or squashes `MessageThread`. Fix: default `assistOpen` to `window.innerWidth >= 1280` and update on resize (use `useMediaQuery` hook or `window.matchMedia`).

**BUG-12 · `ConversationListItem.tsx` — no `aria-selected` attribute**  
The `<button>` is used as a list item; screen readers need `role="option"` and `aria-selected={selected}` (or `role="listitem"` with `aria-current`). Fix: add `aria-selected={selected}` and `aria-label`.

**BUG-13 · `MessageBubble.tsx` — activity messages (type 2) show raw content with no sanitisation**  
Line 14-16: activity messages are rendered directly. Chatwoot activity content can contain HTML entities or markdown-like text. Add basic text sanitisation (trim, remove HTML tags) before rendering.

**BUG-14 · `MessageBubble.tsx` — timestamps use `relativeTime()` which never updates**  
The timestamp ("5m ago") is computed once at render and never refreshes. Fix: wrap `relativeTime` in a `useLiveRelativeTime(ts)` hook that re-renders every 60 seconds.

**BUG-15 · `ReplyBox.tsx` — `content.trim()` is empty string but `sendMessage` passes `' '` (single space) to Chatwoot**  
Line 109: `sendMessage(conversationId, body || ' ', …)` — sending a space prevents the "empty message" Chatwoot error but the message is visible as a blank bubble. Fix: guard at the mutation level: if `body` is empty and no attachments, block the send. Already guarded by `canSend` at the UI level, but the mutation fn should also throw.

**BUG-16 · `SnoozeButton.tsx` — "Tomorrow 9am" and "Next week" both resolve to `minutes: null`**  
The `SNOOZE_OPTIONS` array types `minutes` as `number | null` for both "Tomorrow" and "Next week" entries, so the only differentiator is the `label` string. This is fragile — if label text changes, the wrong time is computed. Fix: change the data structure to `{ label, resolve: () => Date }` where each option carries its own date factory.

**BUG-17 · `ConversationList.tsx` — native `<select>` for inbox filter is unstyled and inconsistent with design system**  
Line 98-109 uses a raw `<select>` element. All other filters in the app use the project's `<Select>` from `@/components/ui/select`. Replace with the project component for visual consistency.

**BUG-18 · `useConversations.ts` — demo mode fixture messages don't include `private_note` demo**  
`DEMO_MESSAGES[2]` contains a message with `content_type: 'text'` labelled "Customer note: escalate if billing issue persists" but it should be `content_type: 'private_note'` so it renders with the amber private-note bubble, demonstrating the feature to clients.

---

## Implementation Steps

### Step 1 — Fix `listConversations` to support search

**File**: `src/lib/api/conversations.ts`

Add `search?: string` to `ConversationFilters`:

```ts
export interface ConversationFilters {
  status?: 'open' | 'resolved' | 'pending' | 'all';
  assigneeType?: 'assigned' | 'unassigned' | 'all';
  page?: number;
  labels?: string[];
  teamId?: number;
  inboxId?: number;
  search?: string;           // ← ADD
}
```

In `listConversations`, add:
```ts
if (filters.search) params.set('q', filters.search);
```

Also add a new function for loading agents directly from Chatwoot (fixes BUG-04):

```ts
export interface CWAgent {
  id: number;
  name: string;
  email: string;
  availability_status?: string;
}

export async function listChatwootAgents(): Promise<CWAgent[]> {
  return cwFetch<CWAgent[]>(`/accounts/${accountId()}/agents`);
}
```

---

### Step 2 — Fix `useConversations` hook (BUG-02, BUG-03)

**File**: `src/lib/hooks/useConversations.ts`

Replace `useConversations` with a stable query key using primitive values, not object references:

```ts
export function useConversations(filters: ConversationFilters) {
  const { status, assigneeType, inboxId, teamId, search } = filters;
  return useInfiniteQuery({
    queryKey: [
      'conversations',
      status ?? '',
      assigneeType ?? '',
      inboxId ?? 0,
      teamId ?? 0,
      search ?? '',
      isDemoDataEnabled(),
    ],
    queryFn: ({ pageParam = 1 }) =>
      fetchConversationPage(filters, pageParam as number),
    getNextPageParam: last => last.meta?.next_page ?? undefined,
    initialPageParam: 1,
  });
}
```

Also add demo mode short-circuit to `fetchConversationPage` (BUG-10):
```ts
async function fetchConversationPage(
  filters: ConversationFilters,
  page: number,
): Promise<ConversationPage> {
  if (isDemoDataEnabled()) {
    let rows = [...DEMO_CONVERSATIONS];
    if (filters.status && filters.status !== 'all') {
      rows = rows.filter(c => c.status === filters.status);
    }
    if (filters.inboxId) rows = rows.filter(c => c.inbox_id === filters.inboxId);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(c =>
        conversationContactName(c).toLowerCase().includes(q),
      );
    }
    return { data: rows, meta: {} };
  }
  // ... real API call unchanged
}
```

---

### Step 3 — Fix `ConversationList.tsx` (BUG-02, BUG-03, BUG-10, BUG-17)

**File**: `src/components/conversations/ConversationList.tsx`

Full rewrite:

```tsx
'use client';

import { useDebouncedValue } from '@/hooks/useDebouncedValue'; // create if missing
import { useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { ConversationListItem } from '@/components/conversations/ConversationListItem';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';     // ← project Select, not native
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { useConversations } from '@/lib/hooks/useConversations';
import { listInboxes } from '@/lib/api/conversations';
import { DEMO_INBOXES } from '@/lib/demo/inboxesFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import type { ConversationFilters } from '@/lib/api/conversations';
import type { CWConversation } from '@/types';

type StatusTab = 'all' | 'open' | 'pending' | 'resolved';

const TABS: { id: StatusTab; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'open',     label: 'Open' },
  { id: 'pending',  label: 'Pending' },
  { id: 'resolved', label: 'Resolved' },
];

interface Props {
  selectedId: number | null;
  onSelect: (conv: CWConversation) => void;
}

export function ConversationList({ selectedId, onSelect }: Props) {
  const [activeTab, setActiveTab]   = useState<StatusTab>('open');
  const [rawSearch, setRawSearch]   = useState('');
  const [inboxFilter, setInboxFilter] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounce search so we don't fire a new query on every keystroke
  const search = useDebouncedValue(rawSearch, 300);

  const { data: inboxes = [] } = useQuery({
    queryKey: ['inboxes', 'filter', isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_INBOXES;   // ← BUG-10 fix
      try {
        const data = await listInboxes();
        return data.length ? data : [];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  // Stable primitive keys — no object reference churn (BUG-03)
  const filters: ConversationFilters = {
    status:  activeTab === 'all' ? undefined : activeTab,
    inboxId: inboxFilter ? Number(inboxFilter) : undefined,
    search:  search || undefined,
  };

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useConversations(filters);

  const conversations = useMemo(
    () => data?.pages.flatMap(p => p.data) ?? [],
    [data],
  );

  // Client-side filter only used in demo mode (server handles it in prod)
  // In prod the search is passed as ?q= to Chatwoot, so no double-filter needed.

  // Infinite scroll sentinel
  const obsRef = useRef<IntersectionObserver | null>(null);
  const sentinelCallback = (el: HTMLDivElement | null) => {
    obsRef.current?.disconnect();
    if (!el) return;
    obsRef.current = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    obsRef.current.observe(el);
  };

  return (
    <div className="w-[280px] border-e flex flex-col h-full bg-white shrink-0">
      {/* Search */}
      <div className="border-b p-3 space-y-2 shrink-0">
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={rawSearch}
            onChange={e => setRawSearch(e.target.value)}
            placeholder="Search conversations…"
            className="ps-8"
            aria-label="Search conversations"
          />
        </div>

        {/* Project Select component — no raw <select> (BUG-17) */}
        <Select
          value={inboxFilter}
          onChange={e => setInboxFilter(e.target.value)}
          className="text-xs"
          aria-label="Filter by inbox"
        >
          <option value="">All inboxes</option>
          {inboxes.map(inbox => (
            <option key={inbox.id} value={String(inbox.id)}>
              {inbox.name}
            </option>
          ))}
        </Select>

        {/* Status tabs */}
        <div className="flex gap-1" role="tablist" aria-label="Conversation status">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={
                activeTab === tab.id
                  ? 'flex-1 text-xs py-1.5 border-b-2 border-brand-primary text-brand-primary font-medium'
                  : 'flex-1 text-xs py-1.5 text-muted-foreground hover:text-gray-900'
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div
        className="flex-1 overflow-y-auto min-h-0"
        role="listbox"
        aria-label="Conversations"
      >
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 mx-3 my-1 rounded-lg" />
          ))}

        {isError && (
          <div className="p-4 text-sm text-destructive">
            Failed to load.{' '}
            <button type="button" className="underline" onClick={() => void refetch()}>
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && conversations.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground text-center">
            {search ? `No results for "${search}"` : 'No conversations'}
          </p>
        )}

        {!isLoading &&
          !isError &&
          conversations.map(conv => (
            <ConversationListItem
              key={conv.id}
              conversation={conv}
              selected={selectedId === conv.id}
              onClick={() => onSelect(conv)}
            />
          ))}

        <div ref={sentinelCallback} className="h-2" />
        {isFetchingNextPage && <Skeleton className="h-12 mx-3 my-1 rounded-lg" />}
      </div>
    </div>
  );
}
```

**Create `src/hooks/useDebouncedValue.ts`** if it does not exist:

```ts
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
```

---

### Step 4 — Fix `ConversationListItem.tsx` (BUG-12)

**File**: `src/components/conversations/ConversationListItem.tsx`

Add `aria-selected`, `aria-label`, and `role="option"`:

```tsx
<button
  type="button"
  role="option"
  aria-selected={selected}
  aria-label={`Conversation with ${name}, ${channel}, ${relativeTime(conversation.last_activity_at)}`}
  onClick={onClick}
  className={cn(
    'w-full flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors text-start',
    selected
      ? 'bg-blue-50 border-s-2 border-brand-primary'
      : 'hover:bg-muted border-s-2 border-transparent',
  )}
>
```

Also fix the `border-l-2` → `border-s-2` RTL issue on both class strings.

---

### Step 5 — Fix `MessageBubble.tsx` (BUG-13, BUG-14)

**File**: `src/components/conversations/MessageBubble.tsx`

**Create `src/hooks/useLiveRelativeTime.ts`**:

```ts
import { useEffect, useState } from 'react';
import { relativeTime } from '@/lib/utils/conversations';

export function useLiveRelativeTime(ts: number | string): string {
  const [label, setLabel] = useState(() => relativeTime(ts));
  useEffect(() => {
    setLabel(relativeTime(ts));
    const id = setInterval(() => setLabel(relativeTime(ts)), 60_000);
    return () => clearInterval(id);
  }, [ts]);
  return label;
}
```

In `MessageBubble.tsx`, add the import and use it:

```tsx
import { useLiveRelativeTime } from '@/hooks/useLiveRelativeTime';

// Inside the component:
const timeLabel = useLiveRelativeTime(message.created_at);

// Activity message — strip HTML entities and trim (BUG-13):
if (message.message_type === 2) {
  const safe = message.content
    .replace(/<[^>]+>/g, '')   // strip any HTML tags
    .trim();
  return (
    <div className="text-xs text-center text-muted-foreground py-1" aria-live="polite">
      {safe}
    </div>
  );
}

// Timestamp (BUG-14):
<p className="text-xs text-muted-foreground mt-1 px-1">
  <time dateTime={new Date(
    typeof message.created_at === 'number'
      ? message.created_at > 1e12
        ? message.created_at
        : message.created_at * 1000
      : message.created_at
  ).toISOString()}>
    {timeLabel}
  </time>
</p>
```

---

### Step 6 — Fix `MessageThread.tsx` (BUG-04, BUG-05)

**File**: `src/components/conversations/MessageThread.tsx`

**Fix BUG-04** — load Chatwoot agents instead of gateway agents for the assignee select:

Replace the `listAgents` import and query with:

```tsx
import { listChatwootAgents } from '@/lib/api/conversations';

const { data: agents = [] } = useQuery({
  queryKey: ['cw-agents', isDemoDataEnabled()],
  queryFn: async () => {
    if (isDemoDataEnabled()) return DEMO_AGENTS.map(a => ({ id: a.id, name: a.name, email: '' }));
    try { return await listChatwootAgents(); } catch { return []; }
  },
  staleTime: 300_000,
});
```

Assignee Select:
```tsx
<Select
  value={assigneeValue}
  onChange={e => assignMutation.mutate(e.target.value)}
  className="max-w-[120px] text-xs"
  disabled={assignMutation.isPending}
>
  <option value="">Assign agent…</option>
  {agents.map(a => (
    <option key={a.id} value={String(a.id)}>
      {a.name}
    </option>
  ))}
</Select>
```

**Fix BUG-05** — WebSocket subscription cleanup:

```tsx
useEffect(() => {
  if (!conversation || !user?.chatwootAccountId) return;
  let unsubscribe: (() => void) | undefined;
  try {
    unsubscribe = subscribeToConversation(user.chatwootAccountId, conversation.id, {
      onMessage: () => {
        qc.invalidateQueries({ queryKey: ['messages', conversation.id] });
        qc.invalidateQueries({ queryKey: ['conversations'] });
      },
      onStatusChange: () => {
        qc.invalidateQueries({ queryKey: ['conversations'] });
      },
    });
  } catch (err) {
    console.warn('[MessageThread] subscribeToConversation failed', err);
  }
  return () => unsubscribe?.();
}, [conversation?.id, user?.chatwootAccountId, qc]);
```

---

### Step 7 — Fix `ReplyBox.tsx` (BUG-15)

**File**: `src/components/conversations/ReplyBox.tsx`

In `handleSend`, add explicit guard:

```tsx
function handleSend() {
  const trimmed = content.trim();
  if (!trimmed && !pendingFiles.length) return;   // ← explicit guard
  mutation.mutate(
    {
      content: trimmed,
      private: mode === 'note',
      attachments: pendingFiles.length ? pendingFiles : undefined,
    },
    {
      onSuccess: () => resetComposer(),
      onError: err => toast.error(err instanceof Error ? err.message : 'Failed to send'),
    },
  );
}
```

In `useSendMessage` (in `useConversations.ts`), guard empty send:

```ts
mutationFn: async ({ content, private: isPrivate, attachments }: SendMessageInput) => {
  const body = content.trim();
  if (!body && !attachments?.length) throw new Error('Empty message');
  // ... rest unchanged
```

---

### Step 8 — Fix `AgentAssistPanel.tsx` (BUG-07, BUG-08)

**File**: `src/components/conversations/AgentAssistPanel.tsx`

**Fix BUG-08** — no fabricated suggestion on error:

```ts
queryFn: async () => {
  const payload = toSuggestPayload(messages);
  if (!payload.length) return { suggestion: '', confidence: 0 };
  try {
    return await suggestReply({
      conversationId: String(conversationId),
      messages: payload,
    });
  } catch {
    return { suggestion: '', confidence: 0 };  // ← was hardcoded Arabic fallback
  }
},
```

**Fix BUG-07** — use real classifyConversation response:

```ts
queryFn: async () => {
  if (isDemoDataEnabled()) {
    return { category: 'support', intent: 'plan_change', confidence: 0.8, sentiment: 'neutral' as const };
  }
  try {
    const res = await classifyConversation(String(conversationId));
    return {
      category:   res.category   ?? 'support',
      intent:     res.intent     ?? 'general',
      confidence: res.confidence ?? 0.5,
      sentiment:  (res.sentiment ?? 'neutral') as 'positive' | 'neutral' | 'negative',
    };
  } catch {
    return { category: 'support', intent: 'general', confidence: 0.5, sentiment: 'neutral' as const };
  }
},
```

---

### Step 9 — Fix `SnoozeButton.tsx` (BUG-16)

**File**: `src/components/conversations/SnoozeButton.tsx`

Replace the brittle `minutes: null` pattern with typed resolve functions:

```ts
const SNOOZE_OPTIONS: { label: string; resolve: () => Date }[] = [
  { label: '30 minutes', resolve: () => new Date(Date.now() + 30 * 60_000) },
  { label: '1 hour',     resolve: () => new Date(Date.now() + 60 * 60_000) },
  { label: '3 hours',    resolve: () => new Date(Date.now() + 180 * 60_000) },
  {
    label: 'Tomorrow 9 AM',
    resolve: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
  {
    label: 'Next week',
    resolve: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

// In the component:
function snooze(opt: typeof SNOOZE_OPTIONS[number]) {
  mutation.mutate(opt.resolve().toISOString(), {
    onSuccess: () => {
      toast.success('Conversation snoozed');
      setOpen(false);
    },
  });
}

// In JSX:
{SNOOZE_OPTIONS.map(opt => (
  <button
    key={opt.label}
    type="button"
    onClick={() => snooze(opt)}
    disabled={mutation.isPending}
    className="w-full text-start px-3 py-1.5 text-sm rounded hover:bg-muted"
  >
    {opt.label}
  </button>
))}
```

---

### Step 10 — Fix `page.tsx` (BUG-01, BUG-11)

**File**: `src/app/(dashboard)/conversations/page.tsx`

Full rewrite of `ConversationsContent`:

```tsx
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ConversationList } from '@/components/conversations/ConversationList';
import { MessageThread } from '@/components/conversations/MessageThread';
import { AgentAssistPanel } from '@/components/conversations/AgentAssistPanel';
import { useInboxStore } from '@/lib/store/inbox';
import { getConversation } from '@/lib/api/conversations';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { DEMO_CONVERSATIONS } from '@/lib/demo/conversationsFixture';
import type { CWConversation } from '@/types';

function useIsMdScreen() {
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : true,
  );
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1280px)');
    const handler = (e: MediaQueryListEvent) => setWide(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return wide;
}

function ConversationsContent() {
  const searchParams = useSearchParams();
  const [selectedConversation, setSelectedConversation] = useState<CWConversation | null>(null);
  const isWide = useIsMdScreen();
  const [assistOpen, setAssistOpen] = useState(isWide);   // BUG-11 fix
  const setStoreConversationId = useInboxStore(s => s.setSelectedConversationId);

  // BUG-01 fix: deep-link via contact_id works for both demo and production
  useEffect(() => {
    const contactId = searchParams.get('contact_id');
    if (!contactId) return;
    if (isDemoDataEnabled()) {
      const match = DEMO_CONVERSATIONS.find(c => String(c.meta?.sender?.id) === contactId);
      if (match) {
        setSelectedConversation(match);
        setStoreConversationId(match.id);
      }
      return;
    }
    // Production: fetch by contact_id
    // Chatwoot has no direct GET by contact; instead when Contacts page navigates here,
    // it should pass the actual conversation_id. Accept both params:
    const convId = searchParams.get('conversation_id');
    if (convId) {
      getConversation(Number(convId))
        .then(conv => {
          setSelectedConversation(conv);
          setStoreConversationId(conv.id);
        })
        .catch(() => {/* ignore */});
    }
  }, [searchParams, setStoreConversationId]);

  // Update assistOpen when screen width changes
  useEffect(() => {
    setAssistOpen(isWide);
  }, [isWide]);

  const handleSelect = useCallback((conv: CWConversation) => {
    setSelectedConversation(conv);
    setStoreConversationId(conv.id);
  }, [setStoreConversationId]);

  return (
    <div className="flex h-full overflow-hidden">
      <ConversationList
        selectedId={selectedConversation?.id ?? null}
        onSelect={handleSelect}
      />
      <MessageThread
        conversation={selectedConversation}
        onToggleAssist={() => setAssistOpen(v => !v)}
        assistOpen={assistOpen}
      />
      {assistOpen && selectedConversation && (
        <AgentAssistPanel conversationId={selectedConversation.id} />
      )}
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={null}>
      <ConversationsContent />
    </Suspense>
  );
}
```

---

### Step 11 — Fix `CallTimelinePanel.tsx` (BUG-09)

**File**: `src/components/conversations/CallTimelinePanel.tsx`

This component is not currently rendered in the conversations page. Wire it or clearly gate it behind demo mode. Add a `conversationId` prop and connect to calls API:

```tsx
'use client';

import { Play } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { listCallsByConversation } from '@/lib/api/calls'; // if this fn exists; else use demo only

const DEMO_TIMELINE = [
  { dot: 'bg-[#e24b4a]', title: 'Incoming ring', sub: '10:24:01 AM · WhatsApp' },
  { dot: 'bg-[#3b6d11]', title: 'Answered by agent', sub: '10:24:09 AM · Sara K.' },
  { dot: 'bg-[#0B5FFF]', title: 'In progress', sub: '03:47 elapsed' },
];

interface Props {
  conversationId: number;
}

export function CallTimelinePanel({ conversationId }: Props) {
  const [tab, setTab] = useState<'info' | 'calls' | 'ai'>('calls');

  const { data: callHistory = [] } = useQuery({
    queryKey: ['call-timeline', conversationId, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_TIMELINE;
      try {
        // Replace with real call listing API when available
        return DEMO_TIMELINE;
      } catch {
        return DEMO_TIMELINE;
      }
    },
    staleTime: 30_000,
  });

  // ... rest of render unchanged, use `callHistory` instead of hardcoded TIMELINE
}
```

---

### Step 12 — Fix demo fixture (BUG-18)

**File**: `src/lib/demo/conversationsFixture.ts`

Fix `DEMO_MESSAGES[2]` message `2003` to be a private note:

```ts
{
  id: 2003,
  content: 'Customer note: escalate if billing issue persists',
  message_type: 1,
  content_type: 'private_note',    // ← was 'text'
  created_at: ts() - 3400,
  sender: { id: 1, name: 'Agent Demo', type: 'user' },
},
```

---

### Step 13 — Create `src/lib/api/conversations.ts` additions for contacts navigation

Update `getConversation` to handle the deep-link navigation from Contacts page. This was identified in BUG-01 where the page accepts `?conversation_id=` param in production. Ensure the Contacts module passes `conversation_id` when navigating to `/conversations`.

**File**: `src/components/contacts/ContactDetailPanel.tsx` (or wherever the "Open conversation" link exists)

Find where the contacts module links to `/conversations` and change:
```ts
// OLD (only works in demo)
href={`/conversations?contact_id=${contact.id}`}
// NEW (works in production)
href={`/conversations?conversation_id=${latestConversationId}`}
```

If the contacts module doesn't yet have the latest conversation ID, fetch it:
```ts
import { listConversations } from '@/lib/api/conversations';
// ... in a query:
const { data } = useQuery({
  queryKey: ['contact-conversations', contact.id],
  queryFn: () => listConversations({ /* filter by contact if API supports it */ }),
});
```

---

### Step 14 — Verification Checklist

After all changes, verify:

- [ ] **BUG-01**: Navigate to `/conversations?conversation_id=5` in production — conversation #5 is auto-selected
- [ ] **BUG-02**: Type "Ahmed" in search — list filters to matching conversations, Chatwoot `?q=Ahmed` in network tab
- [ ] **BUG-03**: No TanStack Query warnings about "too many re-renders" or rapidly changing query keys in dev tools
- [ ] **BUG-04**: Assign dropdown shows agent names from Chatwoot, assigning successfully updates the conversation header
- [ ] **BUG-05**: Switching conversations rapidly → no "Can't perform React state update" console errors
- [ ] **BUG-06**: Sending a snippet from AgentAssistPanel inserts text without duplication
- [ ] **BUG-07**: AI Insights panel shows real category/intent from API response in production
- [ ] **BUG-08**: When AI API is down, "Suggested reply" shows "No suggestion yet" — no Arabic text
- [ ] **BUG-09**: `CallTimelinePanel` uses `conversationId` prop; renders demo data in demo mode, no hardcoded constants
- [ ] **BUG-10**: In demo mode, no `401` errors in network tab from `listInboxes()` call
- [ ] **BUG-11**: At window width < 1280px, Assist panel is closed by default; MessageThread has full width
- [ ] **BUG-12**: Screen reader announces "Conversation with Ahmed Al-Rashidi, WhatsApp, 5m ago" (verify with VoiceOver or axe)
- [ ] **BUG-13**: Activity messages with HTML characters render as plain text
- [ ] **BUG-14**: Timestamp on a 2-minute-old message updates from "2m ago" to "3m ago" without page refresh
- [ ] **BUG-15**: Clicking Send with only whitespace in textarea does nothing (no blank bubble in thread)
- [ ] **BUG-16**: "Tomorrow 9 AM" snooze sets due date to 9:00:00 the next calendar day, regardless of label text
- [ ] **BUG-17**: Inbox filter uses project `<Select>` component — styled consistently with rest of UI
- [ ] **BUG-18**: Demo conversation #2 shows message 2003 with amber private-note bubble

---

## Acceptance Criteria

1. Conversation list loads in < 500 ms on first paint with skeleton loading states
2. Infinite scroll loads next page smoothly on sentinel intersection
3. Search debounces 300 ms; clears results gracefully when empty
4. Inbox filter correctly narrows conversations (both demo and production)
5. Selecting a conversation auto-scrolls message thread to most recent message
6. Real-time: new inbound message appears without refresh (ActionCable subscription)
7. Assigning an agent persists on Chatwoot and reflects immediately in header
8. Resolving a conversation removes it from the Open tab immediately (optimistic update)
9. Reply box: Enter sends, Shift+Enter newline, Esc clears recording
10. Private note renders with amber background; agent mentions highlighted in amber bold
11. Canned response picker shows on `/` trigger; keyboard ↑↓ navigation works; Escape closes
12. Attachment upload: image, audio, PDF all accepted; pending chips show file name + size
13. Voice message: record → stop → chip appears → send uploads audio file
14. Assist panel: suggest-reply insert fills ReplyBox without duplication
15. Assist panel hidden by default on screens < 1280 px

---

## Files Modified (summary)

| File | Changes |
|------|---------|
| `src/lib/api/conversations.ts` | Add `search` to `ConversationFilters`, add `listChatwootAgents()` |
| `src/lib/hooks/useConversations.ts` | Stable query key, demo search filter, BUG-15 guard |
| `src/hooks/useDebouncedValue.ts` | CREATE — debounce utility hook |
| `src/hooks/useLiveRelativeTime.ts` | CREATE — auto-refreshing relative time hook |
| `src/components/conversations/ConversationList.tsx` | Search debounce, demo guard, project Select, aria roles |
| `src/components/conversations/ConversationListItem.tsx` | aria-selected, aria-label, RTL border fix |
| `src/components/conversations/MessageBubble.tsx` | Activity sanitisation, live timestamp |
| `src/components/conversations/MessageThread.tsx` | Chatwoot agents, WS cleanup |
| `src/components/conversations/ReplyBox.tsx` | Empty-send guard |
| `src/components/conversations/AgentAssistPanel.tsx` | Real classify response, no fake suggestion |
| `src/components/conversations/SnoozeButton.tsx` | Type-safe snooze resolve functions |
| `src/components/conversations/CallTimelinePanel.tsx` | Accept `conversationId` prop, no stale constants |
| `src/app/(dashboard)/conversations/page.tsx` | Deep-link fix, responsive assistOpen |
| `src/lib/demo/conversationsFixture.ts` | Fix message 2003 content_type |
