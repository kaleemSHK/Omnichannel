# CURSOR PROMPT — STEP 13: Full Chatwoot Feature Parity + Role-Based Access Control
> Paste this ENTIRE file into Cursor Composer.
> This step fills every remaining gap vs Chatwoot and implements a complete RBAC system for all 4 roles.
> Read .cursorrules before writing a single line.
> Do NOT modify src/lib/api/*.ts or src/types/index.ts.

---

## AUDIT SUMMARY — what is missing

### Missing Chatwoot features:
1. **Private notes** — agents can send internal notes (not visible to contact)
2. **Canned responses** — quick-reply shortcuts (type / to search)
3. **Conversation labels** — tag conversations with colored labels
4. **Snooze conversation** — defer a conversation until a time
5. **Team assignment** — assign conversation to a team (not just an agent)
6. **Inbox filter** — filter conversation list by inbox channel
7. **Mentions** — @agent in notes triggers notification
8. **Reports / Analytics** — overview report screen (MISSING entirely)
9. **Conversation filter sidebar** — filter by label, team, inbox, assignee
10. **ConversationsPage renders null** — AgentInboxShell returns null, page shows blank

### Missing RBAC:
- No role guard on any page except sidebar hiding Platform link
- No per-feature permission checks
- No role-based nav (agent sees different items than supervisor/admin)
- No redirect when role lacks permission to a route

---

## PART A — Fix the broken Conversations page

### `src/app/(dashboard)/conversations/page.tsx` — REWRITE completely

The current AgentInboxShell returns null. Replace with the real 3-panel layout:

```tsx
'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ConversationList } from '@/components/conversations/ConversationList'
import { MessageThread } from '@/components/conversations/MessageThread'
import { AgentAssistPanel } from '@/components/conversations/AgentAssistPanel'
import type { CWConversation } from '@/types'

function ConversationsInner() {
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<CWConversation | null>(null)
  const [assistOpen, setAssistOpen] = useState(true)

  return (
    <div className="flex h-full overflow-hidden">
      <ConversationList
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
      />
      <MessageThread
        conversation={selected}
        assistOpen={assistOpen}
        onToggleAssist={() => setAssistOpen(v => !v)}
      />
      {assistOpen && selected && (
        <AgentAssistPanel conversationId={selected.id} />
      )}
    </div>
  )
}

export default function ConversationsPage() {
  return (
    <Suspense>
      <ConversationsInner />
    </Suspense>
  )
}
```

---

## PART B — Chatwoot Feature Parity (add to existing components)

### B1. Private Notes in ReplyBox

**Modify `src/components/conversations/ReplyBox.tsx`:**

Add a toggle tab above the textarea: **Reply** | **Note** (private)

```tsx
// Add state:
const [mode, setMode] = useState<'reply' | 'note'>('reply')

// Add tab UI above the textarea:
<div className="flex border-b mb-2">
  <button
    onClick={() => setMode('reply')}
    className={cn('px-3 py-1.5 text-xs font-medium border-b-2 transition-colors',
      mode === 'reply' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
    )}
  >
    Reply
  </button>
  <button
    onClick={() => setMode('note')}
    className={cn('px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1',
      mode === 'note' ? 'border-amber-500 text-amber-600' : 'border-transparent text-muted-foreground hover:text-foreground'
    )}
  >
    <Lock className="w-3 h-3" /> Note
  </button>
</div>

// Change textarea bg when in note mode:
className={cn('min-h-[40px] max-h-32 resize-none flex-1',
  mode === 'note' && 'bg-amber-50 border-amber-200'
)}

// Change sendMessage call:
mutation.mutate({
  content: content.trim(),
  message_type: mode === 'note' ? 'outgoing' : 'outgoing',
  private: mode === 'note',  // Chatwoot private note flag
})

// Note mode: wrap ReplyBox in amber-tinted container
// Note mode send button: amber bg instead of brand-primary
```

Also update `useSendMessage` mutation in `useConversations.ts` to pass `private: boolean` to `sendMessage()`.

---

### B2. Canned Responses — quick-reply with `/`

**Create `src/components/conversations/CannedResponsePicker.tsx`:**

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

// Fetch canned responses from Chatwoot:
// GET /api/v1/accounts/{accountId}/canned_responses?search={query}
// Use cwFetch from client.ts (already written in conversations.ts or add here)

interface CannedResponse {
  id: number
  short_code: string
  content: string
}

interface Props {
  query: string           // text after "/" typed in ReplyBox
  onSelect: (text: string) => void
  onClose: () => void
}

export function CannedResponsePicker({ query, onSelect, onClose }: Props) {
  const { data = [] } = useQuery({
    queryKey: ['cannedResponses', query],
    queryFn: async () => {
      const { cwFetch } = await import('@/lib/api/client')
      const accountId = /* useAuthStore().user.chatwootAccountId */ 1
      const res = await cwFetch(`/api/v1/accounts/${accountId}/canned_responses?search=${encodeURIComponent(query)}`)
      return res.json() as Promise<CannedResponse[]>
    },
    enabled: query.length >= 1,
  })

  if (data.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 w-full mb-1 bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
      {data.map(cr => (
        <button
          key={cr.id}
          onClick={() => { onSelect(cr.content); onClose() }}
          className="w-full text-start px-3 py-2 hover:bg-muted flex gap-3 items-start"
        >
          <code className="text-xs bg-blue-50 text-brand-primary px-1.5 py-0.5 rounded shrink-0 mt-0.5">
            /{cr.short_code}
          </code>
          <span className="text-sm text-muted-foreground line-clamp-2">{cr.content}</span>
        </button>
      ))}
    </div>
  )
}
```

**Modify `src/components/conversations/ReplyBox.tsx`** to trigger canned responses:

```tsx
// Add state:
const [cannedQuery, setCannedQuery] = useState<string | null>(null)

// In onChange handler of Textarea:
function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
  const val = e.target.value
  setContent(val)
  // Detect "/" at start of line or after newline
  const lastLine = val.split('\n').pop() ?? ''
  if (lastLine.startsWith('/') && lastLine.length > 1) {
    setCannedQuery(lastLine.slice(1))
  } else {
    setCannedQuery(null)
  }
}

// Render above ReplyBox (relative container needed):
<div className="relative">
  {cannedQuery !== null && (
    <CannedResponsePicker
      query={cannedQuery}
      onSelect={text => { setContent(text); setCannedQuery(null) }}
      onClose={() => setCannedQuery(null)}
    />
  )}
  <Textarea ... onChange={handleChange} />
</div>
```

---

### B3. Conversation Labels

**Create `src/components/conversations/LabelPicker.tsx`:**

```tsx
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tag } from 'lucide-react'
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// Labels come from Chatwoot: GET /api/v1/accounts/{accountId}/labels
// Apply label: POST /api/v1/accounts/{accountId}/conversations/{id}/labels
// Body: { labels: ['label1', 'label2'] }

interface Props {
  conversationId: number
  currentLabels: string[]
}

const LABEL_COLORS: Record<string, string> = {
  // Map label title to a color - Chatwoot returns color with each label
}

export function LabelPicker({ conversationId, currentLabels }: Props) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: allLabels = [] } = useQuery({
    queryKey: ['labels'],
    queryFn: async () => {
      const { cwFetch } = await import('@/lib/api/client')
      // get accountId from auth store
      const res = await cwFetch(`/api/v1/accounts/1/labels`)
      const json = await res.json()
      return json.payload as { id: number; title: string; color: string; show_on_sidebar: boolean }[]
    },
  })

  const mutation = useMutation({
    mutationFn: async (labels: string[]) => {
      const { cwFetch } = await import('@/lib/api/client')
      const res = await cwFetch(`/api/v1/accounts/1/conversations/${conversationId}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels }),
      })
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  })

  function toggle(title: string) {
    const next = currentLabels.includes(title)
      ? currentLabels.filter(l => l !== title)
      : [...currentLabels, title]
    mutation.mutate(next)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border hover:border-brand-primary transition-colors">
          <Tag size={12} />
          {currentLabels.length > 0 ? currentLabels.join(', ') : 'Add label'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Labels</p>
        {allLabels.map(label => (
          <button
            key={label.id}
            onClick={() => toggle(label.title)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm"
          >
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: label.color }}
            />
            {label.title}
            {currentLabels.includes(label.title) && (
              <span className="ms-auto text-brand-primary text-xs">✓</span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
```

**Add LabelPicker to `MessageThread.tsx`** in the TopBar row:
```tsx
import { LabelPicker } from './LabelPicker'
// Inside TopBar, after the status toggle button:
<LabelPicker conversationId={conversation.id} currentLabels={conversation.labels ?? []} />
```

---

### B4. Snooze Conversation

**Create `src/components/conversations/SnoozeButton.tsx`:**

```tsx
'use client'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlarmClock } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'

// Chatwoot snooze: PATCH /api/v1/accounts/{accountId}/conversations/{id}/toggle_status
// body: { status: 'snoozed', snoozed_until: ISO_string }

const SNOOZE_OPTIONS = [
  { label: '30 minutes',  minutes: 30 },
  { label: '1 hour',      minutes: 60 },
  { label: '3 hours',     minutes: 180 },
  { label: 'Tomorrow 9am', minutes: null }, // special: next day 09:00
  { label: 'Next week',   minutes: null },  // special: +7 days 09:00
]

interface Props {
  conversationId: number
}

export function SnoozeButton({ conversationId }: Props) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const mutation = useMutation({
    mutationFn: async (snoozedUntil: string) => {
      const { cwFetch } = await import('@/lib/api/client')
      await cwFetch(`/api/v1/accounts/1/conversations/${conversationId}/toggle_status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'snoozed', snoozed_until: snoozedUntil }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Conversation snoozed')
      setOpen(false)
    },
  })

  function snooze(minutes: number | null, label: string) {
    let until: Date
    if (minutes !== null) {
      until = new Date(Date.now() + minutes * 60_000)
    } else if (label.includes('Tomorrow')) {
      until = new Date(); until.setDate(until.getDate() + 1); until.setHours(9, 0, 0, 0)
    } else {
      until = new Date(); until.setDate(until.getDate() + 7); until.setHours(9, 0, 0, 0)
    }
    mutation.mutate(until.toISOString())
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Snooze">
          <AlarmClock size={15} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1">
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Snooze until</p>
        {SNOOZE_OPTIONS.map(opt => (
          <button
            key={opt.label}
            onClick={() => snooze(opt.minutes, opt.label)}
            disabled={mutation.isPending}
            className="w-full text-start px-3 py-1.5 text-sm rounded hover:bg-muted"
          >
            {opt.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
```

**Add SnoozeButton to `MessageThread.tsx`** TopBar (next to status toggle).

---

### B5. Team Assignment in MessageThread

**Modify `src/components/conversations/MessageThread.tsx`** TopBar — add a team select next to the agent select:

```tsx
// Add this alongside the agent assignee <select>:
<select
  value={conversation.meta?.team?.id ? String(conversation.meta.team.id) : ''}
  onChange={e => teamMutation.mutate(e.target.value)}
  className="text-xs border rounded px-2 py-1 max-w-[120px]"
>
  <option value="">No team</option>
  {teams.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
</select>

// Fetch teams from: GET /api/v1/accounts/{accountId}/teams
// Assign team: PATCH /api/v1/accounts/{accountId}/conversations/{id}/assignments
// body: { team_id: number }
const teamMutation = useMutation({
  mutationFn: async (teamId: string) => {
    const { cwFetch } = await import('@/lib/api/client')
    await cwFetch(`/api/v1/accounts/1/conversations/${conversation.id}/assignments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId ? Number(teamId) : null }),
    })
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
})
```

---

### B6. Inbox Filter in ConversationList

**Modify `src/components/conversations/ConversationList.tsx`** — add an inbox filter dropdown in the toolbar:

```tsx
// Add below the search input, above the status tabs:
<div className="flex items-center gap-2">
  <select
    value={inboxFilter}
    onChange={e => setInboxFilter(e.target.value)}
    className="text-xs border rounded px-2 py-1 flex-1"
  >
    <option value="">All inboxes</option>
    {inboxes.map(inbox => (
      <option key={inbox.id} value={String(inbox.id)}>{inbox.name}</option>
    ))}
  </select>
</div>

// Fetch inboxes: GET /api/v1/accounts/{accountId}/inboxes
// Pass inboxId to listConversations filters
```

---

## PART C — Reports / Analytics Screen (MISSING entirely)

**Create these files:**
```
src/app/(dashboard)/reports/page.tsx
src/components/reports/ReportsWorkspace.tsx
src/components/reports/OverviewReport.tsx
src/components/reports/AgentReport.tsx
src/components/reports/InboxReport.tsx
src/components/reports/TeamReport.tsx
```

**Add Reports to IconSidebar** — add after Tickets:
```tsx
{ icon: BarChart2, label: 'Reports', href: '/reports' }
```
(import BarChart2 from lucide-react)

### `src/app/(dashboard)/reports/page.tsx`
```tsx
'use client'
import { ReportsWorkspace } from '@/components/reports/ReportsWorkspace'
export default function ReportsPage() {
  return <ReportsWorkspace />
}
```

### `src/components/reports/ReportsWorkspace.tsx`

Layout: [200px reports-nav] | [flex-1 report-content]

Nav items:
- BarChart2 → Overview (default)
- Users → Agent reports
- Inbox → Inbox reports
- Users2 → Team reports

### `src/components/reports/OverviewReport.tsx`

Data from Chatwoot: `GET /api/v1/accounts/{accountId}/reports/agents/conversations`
and `GET /api/v1/accounts/{accountId}/reports/summary`

```tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

// Date range filter: Today | Last 7 days | Last 30 days | Custom
// KPI cards row (from /reports/summary):
//   Total conversations | Resolved | Avg first response time | Avg resolution time | CSAT score

// Charts:
// 1. AreaChart — conversations over time (line per status: open/resolved/pending)
// 2. BarChart — conversations by inbox
// 3. BarChart — conversations by agent (top 10)

export function OverviewReport() {
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d')

  const since = range === 'today'
    ? new Date().toISOString().slice(0, 10)
    : range === '7d'
    ? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const { data: summary, isLoading } = useQuery({
    queryKey: ['reportSummary', range],
    queryFn: async () => {
      const { cwFetch } = await import('@/lib/api/client')
      const res = await cwFetch(`/api/v1/accounts/1/reports/summary?since=${since}&until=${new Date().toISOString().slice(0,10)}`)
      return res.json()
    },
  })

  const KPI_CARDS = [
    { label: 'Total conversations', value: summary?.account?.conversations_count ?? 0 },
    { label: 'Resolved',            value: summary?.account?.resolved_conversations_count ?? 0 },
    { label: 'Avg first response',  value: summary?.account?.avg_first_response_time ?? '—' },
    { label: 'Avg resolution time', value: summary?.account?.avg_resolution_time ?? '—' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Date range tabs */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Overview</h1>
        <div className="flex gap-1 border rounded-lg p-0.5">
          {(['today', '7d', '30d'] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={cn('px-3 py-1 text-xs rounded-md transition-colors',
                range === r ? 'bg-brand-primary text-white' : 'text-muted-foreground hover:bg-muted'
              )}>
              {r === 'today' ? 'Today' : r === '7d' ? 'Last 7 days' : 'Last 30 days'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {isLoading
          ? [1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)
          : KPI_CARDS.map(card => (
              <div key={card.label} className="border rounded-lg p-4 bg-white">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-bold mt-1 text-brand-primary">{card.value}</p>
              </div>
            ))
        }
      </div>

      {/* Conversations over time chart */}
      <div className="border rounded-lg p-4 bg-white">
        <h2 className="text-sm font-semibold mb-4">Conversations over time</h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={summary?.chartData ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Area type="monotone" dataKey="open"     stroke="#0B5FFF" fill="#EFF6FF" name="Open" />
            <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="#ECFDF5" name="Resolved" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Conversations by agent */}
      <div className="border rounded-lg p-4 bg-white">
        <h2 className="text-sm font-semibold mb-4">By agent (top 10)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={summary?.byAgent ?? []} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
            <Tooltip />
            <Bar dataKey="count" fill="#0B5FFF" radius={[0,4,4,0]} name="Conversations" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

### `src/components/reports/AgentReport.tsx`

```tsx
// Agent performance table
// Data: GET /api/v1/accounts/{accountId}/reports/agents/conversations
// Columns: Agent | Open | Resolved | Avg first response | Avg resolution | Online time
// Sortable columns
// Date range filter same as overview
```

### `src/components/reports/InboxReport.tsx`
```tsx
// Same layout as AgentReport but grouped by inbox
// Data: GET /api/v1/accounts/{accountId}/reports/inboxes/conversations
```

### `src/components/reports/TeamReport.tsx`
```tsx
// Same layout but grouped by team
// Data: GET /api/v1/accounts/{accountId}/reports/teams/conversations
```

---

## PART D — Role-Based Access Control (RBAC)

### D1. Role definitions

```
agent         — can: conversations, contacts, tickets, calling (own calls only)
                cannot: reports, billing, platform, escalation, settings (team/webhooks)

supervisor    — can: everything agent can + reports, escalation, sla, calling (wallboard + listen)
                cannot: billing, platform, settings (webhooks/inboxes)

admin         — can: everything supervisor + billing, settings (all), reports (all)
                cannot: platform

platform_admin — can: everything + platform admin
```

### D2. Create `src/lib/rbac.ts`

```ts
import type { BlinkoneUser } from '@/types'

export type UserRole = BlinkoneUser['role']

export const ROLE_PERMISSIONS = {
  // Routes — which roles can access
  routes: {
    '/conversations':         ['agent', 'supervisor', 'admin', 'platform_admin'],
    '/calling':               ['agent', 'supervisor', 'admin', 'platform_admin'],
    '/calling/wallboard':     ['supervisor', 'admin', 'platform_admin'],
    '/calling/ivr':           ['admin', 'platform_admin'],
    '/contacts':              ['agent', 'supervisor', 'admin', 'platform_admin'],
    '/sla':                   ['supervisor', 'admin', 'platform_admin'],
    '/escalation':            ['supervisor', 'admin', 'platform_admin'],
    '/ai':                    ['agent', 'supervisor', 'admin', 'platform_admin'],
    '/billing':               ['admin', 'platform_admin'],
    '/platform':              ['platform_admin'],
    '/tickets':               ['agent', 'supervisor', 'admin', 'platform_admin'],
    '/reports':               ['supervisor', 'admin', 'platform_admin'],
    '/settings':              ['agent', 'supervisor', 'admin', 'platform_admin'],
  } as Record<string, UserRole[]>,

  // Features within pages
  features: {
    sendPrivateNote:          ['agent', 'supervisor', 'admin', 'platform_admin'],
    assignConversation:       ['supervisor', 'admin', 'platform_admin'],
    resolveConversation:      ['agent', 'supervisor', 'admin', 'platform_admin'],
    viewReports:              ['supervisor', 'admin', 'platform_admin'],
    manageBilling:            ['admin', 'platform_admin'],
    manageWebhooks:           ['admin', 'platform_admin'],
    manageInboxes:            ['admin', 'platform_admin'],
    manageTeam:               ['admin', 'platform_admin'],
    supervisorListen:         ['supervisor', 'admin', 'platform_admin'],
    supervisorWhisper:        ['supervisor', 'admin', 'platform_admin'],
    supervisorBarge:          ['supervisor', 'admin', 'platform_admin'],
    viewWallboard:            ['supervisor', 'admin', 'platform_admin'],
    manageEscalation:         ['supervisor', 'admin', 'platform_admin'],
    manageSLA:                ['supervisor', 'admin', 'platform_admin'],
    manageIVR:                ['admin', 'platform_admin'],
    impersonateTenant:        ['platform_admin'],
  } as Record<string, UserRole[]>,
} as const

export function can(role: UserRole | undefined, feature: keyof typeof ROLE_PERMISSIONS.features): boolean {
  if (!role) return false
  return (ROLE_PERMISSIONS.features[feature] as UserRole[]).includes(role)
}

export function canAccessRoute(role: UserRole | undefined, pathname: string): boolean {
  if (!role) return false
  // find longest matching route prefix
  const match = Object.entries(ROLE_PERMISSIONS.routes)
    .filter(([route]) => pathname.startsWith(route))
    .sort((a, b) => b[0].length - a[0].length)[0]
  if (!match) return true // unknown routes: allow
  return (match[1] as UserRole[]).includes(role)
}

// Role display names + colors for UI
export const ROLE_META: Record<UserRole, { label: string; color: string }> = {
  agent:          { label: 'Agent',          color: 'bg-blue-100 text-blue-700' },
  supervisor:     { label: 'Supervisor',     color: 'bg-purple-100 text-purple-700' },
  admin:          { label: 'Admin',          color: 'bg-green-100 text-green-700' },
  platform_admin: { label: 'Platform Admin', color: 'bg-red-100 text-red-700' },
}
```

### D3. Create `src/components/layout/RoleGuard.tsx`

```tsx
'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth'
import { canAccessRoute } from '@/lib/rbac'

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, tokens } = useAuthStore()

  useEffect(() => {
    if (!tokens || !user) {
      router.replace('/login')
      return
    }
    if (!canAccessRoute(user.role, pathname)) {
      // Redirect to first allowed route for this role
      const fallback = user.role === 'agent' ? '/conversations' : '/conversations'
      router.replace(fallback)
    }
  }, [tokens, user, pathname, router])

  if (!tokens || !user) return null

  return <>{children}</>
}
```

### D4. Update `src/app/(dashboard)/layout.tsx`

Replace the current manual auth check with RoleGuard:

```tsx
import { RoleGuard } from '@/components/layout/RoleGuard'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <IconSidebar />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <TopBar />
          <main className="flex flex-1 flex-col overflow-hidden min-h-0">
            <ActiveCallBar />
            <div className="flex-1 overflow-auto min-h-0">{children}</div>
          </main>
        </div>
        <PhonePanel />
      </div>
    </RoleGuard>
  )
}
```

### D5. Update `src/components/layout/IconSidebar.tsx`

Filter nav items by role using `canAccessRoute`:

```tsx
import { canAccessRoute } from '@/lib/rbac'

// Inside component, after getting role:
const role = useAuthStore(s => s.user?.role)

// Filter navItems:
const visibleNavItems = navItems.filter(item => canAccessRoute(role, item.href))

// Replace {navItems.map...} with {visibleNavItems.map...}

// Add Reports nav item to navItems array:
{ icon: BarChart2, label: 'Reports', href: '/reports' },
```

### D6. Update `src/components/layout/TopBar.tsx`

Add role badge next to user name:

```tsx
import { ROLE_META } from '@/lib/rbac'
import { cn } from '@/lib/utils/cn'

// Inside TopBar, next to user name:
<span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
  ROLE_META[user.role as keyof typeof ROLE_META]?.color ?? 'bg-gray-100 text-gray-600'
)}>
  {ROLE_META[user.role as keyof typeof ROLE_META]?.label ?? user.role}
</span>
```

### D7. Feature-level RBAC in components

Apply `can()` checks to sensitive actions:

**In `MessageThread.tsx`** (agent assignment):
```tsx
import { can } from '@/lib/rbac'
const role = useAuthStore(s => s.user?.role)
// Only show agent/team selectors if user can assign:
{can(role, 'assignConversation') && <select ...agentAssign... />}
{can(role, 'assignConversation') && <select ...teamAssign... />}
```

**In `CallingWorkspace.tsx`** (supervisor controls):
```tsx
{can(role, 'supervisorListen') && (
  <div className="supervisor-controls">
    <button onClick={() => supervisorListen(sessionId)}>Listen</button>
    <button onClick={() => supervisorWhisper(sessionId)}>Whisper</button>
    <button onClick={() => supervisorBarge(sessionId)}>Barge</button>
  </div>
)}
```

**In `SettingsNav.tsx`** — hide admin-only sections from agents:
```tsx
import { can } from '@/lib/rbac'
const role = useAuthStore(s => s.user?.role)
// Filter nav items:
const visibleNavItems = NAV_ITEMS.filter(item => {
  if (item.id === 'team' || item.id === 'inboxes' || item.id === 'webhooks') {
    return can(role, 'manageTeam') || can(role, 'manageInboxes') || can(role, 'manageWebhooks')
  }
  return true
})
```

**In `BillingWorkspace.tsx`** — guard entire page:
```tsx
const role = useAuthStore(s => s.user?.role)
if (!can(role, 'manageBilling')) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <Lock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground text-sm">Admin access required</p>
      </div>
    </div>
  )
}
```

---

## PART E — Role-wise Login Redirect

### Update `src/app/login/page.tsx` onSubmit:

After successful login, redirect based on role:

```tsx
async function onSubmit(data: LoginForm) {
  try {
    const result = await loginWithPassword({ email: data.email, password: data.password })
    useAuthStore.getState().setAuth(result.user, result.tokens)

    // Role-based redirect
    const role = result.user.role
    if (role === 'platform_admin') {
      router.push('/platform')
    } else if (role === 'admin' || role === 'supervisor') {
      router.push('/conversations')  // could be /reports for supervisors
    } else {
      router.push('/conversations')  // agents always go to inbox
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Invalid credentials')
  }
}
```

Also show role label on the login page right panel after successful session (for demo / testing):
```tsx
// On the login form, add a helper text below email field:
<p className="text-xs text-muted-foreground mt-1">
  Role is auto-detected from your account. Agents → Inbox, Supervisors → Inbox + Reports, Admins → Full access.
</p>
```

---

## PART F — Fix TopBar (currently just shows "BlinkOne" and logout)

### `src/components/layout/TopBar.tsx` — full rewrite:

```tsx
'use client'
import { useAuthStore } from '@/lib/store/auth'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut, Bell, Search } from 'lucide-react'
import { ROLE_META } from '@/lib/rbac'
import { cn } from '@/lib/utils/cn'
import type { UserRole } from '@/lib/rbac'

// Page title map
const PAGE_TITLES: Record<string, string> = {
  '/conversations': 'Conversations',
  '/calling':       'Calling',
  '/contacts':      'Contacts',
  '/sla':           'SLA Dashboard',
  '/escalation':    'Escalation Rules',
  '/ai':            'AI Knowledge',
  '/billing':       'Billing & Usage',
  '/platform':      'Platform Admin',
  '/tickets':       'Tickets',
  '/reports':       'Reports',
  '/settings':      'Settings',
}

export function TopBar() {
  const { user, clearAuth } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()

  const pageTitle = Object.entries(PAGE_TITLES)
    .filter(([route]) => pathname.startsWith(route))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? 'BlinkOne'

  const roleMeta = user?.role ? ROLE_META[user.role as UserRole] : null

  function handleLogout() {
    clearAuth()
    router.push('/login')
  }

  return (
    <header className="h-12 shrink-0 border-b border-gray-100 bg-white flex items-center justify-between px-4 gap-4">
      {/* Left: page title */}
      <h1 className="text-sm font-semibold text-gray-900 truncate">{pageTitle}</h1>

      {/* Right: role badge + avatar + logout */}
      <div className="flex items-center gap-2 shrink-0">
        {roleMeta && (
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium hidden sm:inline', roleMeta.color)}>
            {roleMeta.label}
          </span>
        )}
        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
          {user?.name?.slice(0, 2).toUpperCase() ?? '?'}
        </div>
        <span className="text-sm text-gray-600 hidden md:inline">{user?.name}</span>
        <button
          type="button"
          onClick={handleLogout}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
```

---

## COMPLETE CHECKLIST — verify every item:

### Conversations:
- [ ] `/conversations` renders the 3-panel layout (not blank)
- [ ] ReplyBox has "Reply" / "Note" tab — Note mode turns amber
- [ ] Typing `/text` in ReplyBox shows canned response picker
- [ ] Selecting a canned response fills the textarea
- [ ] LabelPicker in MessageThread TopBar — shows all account labels + can toggle
- [ ] SnoozeButton opens popover with time options
- [ ] Team selector in TopBar assigns conversation to a team
- [ ] Inbox filter dropdown in ConversationList filters by channel

### Reports:
- [ ] `/reports` route exists and renders the Reports screen
- [ ] Reports link visible in IconSidebar for supervisor/admin/platform_admin
- [ ] Overview shows KPI cards + AreaChart + BarChart
- [ ] Date range tabs (Today / 7 days / 30 days) reload data
- [ ] Agent report table renders with sortable columns

### RBAC:
- [ ] `src/lib/rbac.ts` exists with `can()` and `canAccessRoute()` exports
- [ ] Agent login → redirected to `/conversations`, Reports/Billing/Platform hidden in sidebar
- [ ] Supervisor login → sees Conversations, Calling, SLA, Escalation, Reports; Billing/Platform hidden
- [ ] Admin login → sees everything except Platform
- [ ] Platform Admin login → redirected to `/platform`, sees all nav items
- [ ] Accessing `/billing` as agent → shows "Admin access required" lock screen
- [ ] Accessing `/platform` as non-platform_admin → redirected to `/conversations`
- [ ] Supervisor controls (Listen/Whisper/Barge) hidden for agent role in CallingWorkspace
- [ ] Agent/team assignment selectors hidden for agent role in MessageThread
- [ ] Settings nav hides Team/Inboxes/Webhooks sections for agent role
- [ ] TopBar shows role badge (Agent=blue, Supervisor=purple, Admin=green, Platform Admin=red)
- [ ] Logout redirects to `/login` (not just clearing state)

### General:
- [ ] `npm run type-check` → 0 errors

✅ All checked? All screens complete. All Chatwoot features parity. Full RBAC in place.
