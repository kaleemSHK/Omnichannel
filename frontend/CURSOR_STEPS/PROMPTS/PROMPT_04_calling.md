# CURSOR PROMPT — STEP 04: Calling Screen + PhonePanel + Wallboard + IVR
> Paste this ENTIRE file into Cursor Composer. Verify every checkbox before moving to PROMPT_05.

---

Read `.cursorrules` before writing anything.

## Files to create:
```
src/app/(dashboard)/calling/page.tsx
src/app/(dashboard)/calling/wallboard/page.tsx
src/app/(dashboard)/calling/ivr/page.tsx
src/components/calling/PhonePanel.tsx
src/components/calling/DialPad.tsx
src/components/calling/ActiveCallBar.tsx
src/components/calling/IncomingCallToast.tsx
src/components/calling/CallListItem.tsx
src/components/calling/AgentStateSelector.tsx
src/components/routing/WallboardTable.tsx
src/components/routing/QueueStats.tsx
src/components/ivr/IVRFlowCanvas.tsx
src/components/ivr/IVRNodePalette.tsx
src/components/ivr/IVRPropertiesPanel.tsx
src/lib/hooks/useCalls.ts
src/lib/hooks/useAgentState.ts
```

Also MODIFY:
```
src/app/(dashboard)/layout.tsx  ← add <PhonePanel /> and <ActiveCallBar />
```

---

## IMPORTANT: Update `src/app/(dashboard)/layout.tsx`

Replace the `<div id="phone-panel" />` stub with the real components:

```tsx
import { PhonePanel } from '@/components/calling/PhonePanel'
import { ActiveCallBar } from '@/components/calling/ActiveCallBar'
// ...
// Inside the layout JSX, before closing </div>:
<PhonePanel />
```

And wrap `<main>` to show `<ActiveCallBar />` at top when a call is active:
```tsx
<main className="flex flex-1 flex-col overflow-hidden">
  <ActiveCallBar />
  {children}
</main>
```

---

## `src/lib/hooks/useCalls.ts`

```ts
import { useQuery } from '@tanstack/react-query'
import { listActiveSessions, listCDR } from '@/lib/api/calls'
import type { CDRFilters } from '@/types'

export function useActiveSessions() {
  return useQuery({
    queryKey: ['activeSessions'],
    queryFn: listActiveSessions,
    refetchInterval: 5000,
  })
}

export function useCDR(filters?: CDRFilters) {
  return useQuery({
    queryKey: ['cdr', filters],
    queryFn: () => listCDR(filters),
  })
}
```

## `src/lib/hooks/useAgentState.ts`

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listAgents, setAgentState } from '@/lib/api/routing'

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: listAgents,
    refetchInterval: 5000,
  })
}

export function useSetAgentState() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, state }: { agentId: string; state: string }) =>
      setAgentState(agentId, state),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  })
}
```

---

## `src/components/calling/PhonePanel.tsx`

'use client' — fixed floating component, always visible.

```tsx
'use client'
import { useJsSip } from '@/lib/hooks/useJsSip'
import { useCallsStore } from '@/lib/store/calls'
import { Phone } from 'lucide-react'

export function PhonePanel() {
  const { activeCall } = useCallsStore()
  // useJsSip() is already initialized — just read state
  
  if (!activeCall) {
    // Collapsed idle button
    return (
      <div className="fixed bottom-4 end-4 z-50">
        <button className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center shadow-lg hover:bg-brand-primary/90">
          <Phone className="w-5 h-5" />
        </button>
      </div>
    )
  }

  // Active call — expanded panel
  return (
    <div className="fixed bottom-4 end-4 z-50 w-72 rounded-xl bg-white border shadow-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-medium">
          {activeCall.contactName?.slice(0, 2).toUpperCase() ?? '??'}
        </div>
        <div>
          <p className="font-medium text-sm">{activeCall.contactName ?? activeCall.remoteNumber}</p>
          <p className="text-xs text-muted-foreground">{activeCall.remoteNumber}</p>
        </div>
        <CallTimer startTime={activeCall.startedAt} className="ms-auto font-mono text-brand-primary font-semibold" />
      </div>
      <CallControls sessionId={activeCall.sessionId} />
    </div>
  )
}

// Sub-component: count-up timer
function CallTimer({ startTime, className }: { startTime: string; className?: string }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = new Date(startTime).getTime()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [startTime])
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  return <span className={className}>{mm}:{ss}</span>
}

// Sub-component: mute/hold/end controls
function CallControls({ sessionId }: { sessionId: string }) {
  const { mute, unmute, hold, hangup } = useJsSip()
  const { activeCall } = useCallsStore()
  const [muted, setMuted] = useState(false)
  
  return (
    <div className="flex gap-2 justify-center">
      <button onClick={() => { muted ? unmute() : mute(); setMuted(!muted) }}
        className={cn('w-10 h-10 rounded-full flex items-center justify-center', muted ? 'bg-brand-primary text-white' : 'bg-muted')}>
        {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
      <button onClick={() => hold()}
        className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        <PauseCircle className="w-4 h-4" />
      </button>
      <button onClick={() => { hangup(); /* endCall(sessionId) */ }}
        className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center">
        <PhoneOff className="w-4 h-4" />
      </button>
    </div>
  )
}
```

---

## `src/components/calling/ActiveCallBar.tsx`

'use client' — renders at top of main content area when `callsStore.activeCall !== null`

```tsx
'use client'
import { useCallsStore } from '@/lib/store/calls'

export function ActiveCallBar() {
  const { activeCall } = useCallsStore()
  if (!activeCall) return null

  return (
    <div className="h-10 bg-green-600 text-white flex items-center gap-4 px-4 text-sm shrink-0">
      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
      <span className="font-medium">{activeCall.contactName ?? activeCall.remoteNumber}</span>
      <CallTimer startTime={activeCall.startedAt} className="font-mono" />
      <div className="ms-auto flex gap-2">
        {/* Mini Mute/Hold/End buttons */}
      </div>
    </div>
  )
}
```

---

## `src/components/calling/IncomingCallToast.tsx`

'use client' — initialize in PhonePanel on mount:

```tsx
// Inside PhonePanel useEffect:
useEffect(() => {
  const unsub = subscribeToCallEvents(accountId, {
    onRinging: (callData) => {
      // Screen pop: search contact
      searchContacts(callData.from).then(contacts => {
        const name = contacts[0]?.name ?? callData.from
        toast.custom((id) => (
          <div className="bg-white border rounded-xl shadow-xl p-4 w-72 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-medium">
                {name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-sm">{name}</p>
                <p className="text-xs text-muted-foreground">{callData.from}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { useJsSip.getState().answerCall(callData.session); toast.dismiss(id) }}
                className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-medium">
                Answer
              </button>
              <button onClick={() => { useJsSip.getState().hangup(); toast.dismiss(id) }}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium">
                Decline
              </button>
            </div>
          </div>
        ), { duration: 30_000 })
      })
    },
  })
  return () => unsub()
}, [accountId])
```

---

## `src/components/calling/AgentStateSelector.tsx`

'use client' — dropdown to set agent state.

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSetAgentState } from '@/lib/hooks/useAgentState'
import { useAuthStore } from '@/lib/store/auth'

const STATE_COLORS = {
  available: 'bg-green-500',
  busy: 'bg-amber-500',
  break: 'bg-pink-500',
  offline: 'bg-gray-400',
}

export function AgentStateSelector() {
  const { user } = useAuthStore()
  const [state, setState] = useState('available')
  const mutation = useSetAgentState()

  function handleChange(newState: string) {
    setState(newState)
    if (user?.id) mutation.mutate({ agentId: String(user.id), state: newState })
  }

  return (
    <Select value={state} onValueChange={handleChange}>
      <SelectTrigger className="w-36 h-8 text-xs">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', STATE_COLORS[state as keyof typeof STATE_COLORS])} />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(STATE_COLORS).map(([value, color]) => (
          <SelectItem key={value} value={value}>
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', color)} />
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

---

## `src/app/(dashboard)/calling/page.tsx`

'use client'. Layout: `[220px call-list] | [flex-1 call-panel] | [240px dialpad]`

```tsx
// Call list sidebar (220px, border-e):
// - PSTN / WhatsApp tabs
// - Active section: useActiveSessions() → CallListItem each (green "Live" badge + timer)
// - Recent section: useCDR({ limit: 20 }) → CallListItem each (Ended/Missed badge)

// Call panel (flex-1):
// TopBar: title + AgentStateSelector
// Incoming call banner (if callsStore.incomingCalls.length > 0):
//   bg-green-50 border border-green-200 rounded-lg p-4
//   Initials avatar, name, number, queue
//   Answer (green, Phone icon) + Decline (red, PhoneOff icon) buttons

// Active call card (if callsStore.activeCall !== null):
//   Initials avatar, contact name, number, SLA tier badge
//   Large count-up timer (text-3xl font-bold text-brand-primary)
//   Control row: Mute | Hold | Transfer | Merge | DTMF | Record | End (red bg)

// Two mini-cards below:
//   Today's CDR table (useCDR with today filter)
//   Queue stats (useQuery for getQueueStats())

// Dialpad (240px, border-s):
// <DialPad /> component
```

---

## `src/components/calling/DialPad.tsx`

'use client'

```tsx
const KEYS = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['*','0','#'],
]

export function DialPad() {
  const [number, setNumber] = useState('')
  const { makeCall } = useJsSip()
  const [tab, setTab] = useState<'pstn' | 'whatsapp'>('pstn')

  function handleCall() {
    if (tab === 'pstn') makeCall(number)
    else createSession({ transport: 'whatsapp', to: number })
  }

  return (
    <div className="p-4 space-y-4">
      <Input value={number} onChange={e => setNumber(e.target.value)}
        className="text-center text-lg font-mono" placeholder="+968" />
      <div className="grid grid-cols-3 gap-2">
        {KEYS.flat().map(key => (
          <button key={key} onClick={() => setNumber(n => n + key)}
            className="h-12 rounded-lg bg-muted hover:bg-muted/80 text-base font-medium transition-colors">
            {key}
          </button>
        ))}
      </div>
      <Button onClick={handleCall} disabled={!number}
        className="w-full bg-green-500 hover:bg-green-600 text-white">
        <Phone className="w-4 h-4 me-2" /> Call
      </Button>
    </div>
  )
}
```

---

## `src/app/(dashboard)/calling/wallboard/page.tsx`

'use client'. Full-width, no secondary sidebar.

```tsx
// TopBar: "Realtime wallboard" + pulsing green dot + "Refreshes every 5s" + queue filter select

// KPI row — 5 cards from getQueueStats():
// Active calls (blue) | Waiting (amber if > 5) | Agents online/total (green) |
// Handled today (neutral) | Missed today (red if miss rate > 10%)

// Queue breakdown — 2-col grid from listQueues():
// Per queue: name, avg wait, Waiting / Active / Agents / Handled

// Agent states table — from useAgents() (refetchInterval: 5000):
// Columns: Agent | State pill | Current call | Duration | Handled today | Actions
// State pills: Available=green, Busy=amber, Break=pink, Offline=gray
// Supervisor actions (Listen/Whisper/Barge) only on Busy rows
// Skeleton while loading
```

---

## `src/app/(dashboard)/calling/ivr/page.tsx`

'use client'. Layout: `[180px palette+flows] | [flex-1 canvas] | [200px properties]`

```tsx
// IVRNodePalette (180px border-e):
// Node types: Play message (blue) | DTMF menu (green) | Voice bot (amber) |
//             Route to queue (teal) | Condition (purple) | Collect input (pink) | Hangup (red)
// Each: colored dot + label, click-to-add to canvas
// Flows list below: listFlows() — click to load, "New flow" button

// IVRFlowCanvas (flex-1):
// Light gray dotted-grid background:
//   background-image: radial-gradient(circle, #e5e7eb 1px, transparent 1px)
//   background-size: 24px 24px
// From getFlow(flowId): render nodes as absolute-positioned white cards
// SVG overlay with <line> elements connecting nodes
// Click node → setSelectedNode(node)

// IVRPropertiesPanel (200px border-s):
// Renders fields for selectedNode type
// "Save changes" button → updateFlow(flowId, updatedNodes)

// TopBar: "Test flow" | "History" | "Publish" → publishFlow(flowId)
```

---

## CHECKLIST — verify every item before moving to PROMPT_05:
- [ ] PhonePanel renders floating on every dashboard page (bottom-right)
- [ ] ActiveCallBar appears at top of main content area when call is active
- [ ] IncomingCallToast fires on `call.ringing` WebSocket event with Answer/Decline buttons
- [ ] Calling page shows PSTN/WhatsApp tabs with active + recent call lists
- [ ] DialPad sends PSTN call via JsSIP on "Call" button
- [ ] AgentStateSelector dropdown updates agent state via API
- [ ] Wallboard table shows agent states with correct color pills
- [ ] Wallboard auto-refreshes every 5 seconds
- [ ] IVR builder canvas shows flow nodes with connector SVG lines
- [ ] IVR properties panel updates when a node is selected
- [ ] `npm run type-check` → 0 errors

✅ All checked? Paste PROMPT_05 into Composer.
