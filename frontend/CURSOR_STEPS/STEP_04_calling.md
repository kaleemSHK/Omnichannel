# STEP 04 — Calling Screen + PhonePanel + Wallboard + IVR
> Paste this entire prompt into Cursor Composer. Do NOT move to STEP 05 until all checks pass.

## What to build

This step covers three sub-routes and the persistent PhonePanel component.

## Files to create

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

---

## PhonePanel (`src/components/calling/PhonePanel.tsx`)

This is a floating component rendered in DashboardLayout. It is ALWAYS present on every page.
- Position: `fixed bottom-4 right-4` (LTR) / `fixed bottom-4 left-4` (RTL)
- Uses `useJsSip()` hook from `src/lib/hooks/useJsSip.ts` — already written, do not rewrite
- Uses `useCallsStore` from `src/lib/store/calls.ts`
- States:
  - **Idle**: small collapsed button (phone icon, brand-primary) 
  - **Active call**: expands to show contact name, timer, mute/hold/end buttons
  - **Incoming call**: shows `IncomingCallToast` via sonner

`IncomingCallToast`: triggered by `subscribeToCallEvents()` BlinkoneCallChannel `call.ringing` event.
- sonner `toast.custom()` with Answer (green) + Decline (red) buttons
- On answer: `useJsSip().answerCall(session)` 
- On screen pop: call `searchContacts(phoneNumber)` and display contact name if found

`ActiveCallBar`: renders at top of main content area when `callsStore.activeCall !== null`
- Shows: contact name, phone number, elapsed timer (count-up from 00:00), Mute/Hold/End mini buttons
- On End: `useJsSip().hangup()` + `endCall(sessionId)`

---

## Calling page (`src/app/(dashboard)/calling/page.tsx`)

Layout: `[220px call-list sidebar] | [flex-1 call-panel] | [240px dialpad]`

**Call-list sidebar:**
- PSTN / WhatsApp tab switcher (border-b tabs)
- "Active" section header + list of active call items from `listActiveSessions()`
  - Each: contact name/number, green "Live" badge, elapsed timer
- "Recent" section header + CDR list from `listCDR({ limit: 20 })`
  - Each: contact name, Ended/Missed badge, duration
- Selected call highlights blue

**TopBar:**
- Active contact name + queue name
- `AgentStateSelector`: dropdown to set agent state (Available/Busy/Break/Offline)
  - Calls `setAgentState(agentId, state)` from routing API
  - Dot color: Available=green, Busy=amber, Break=pink, Offline=gray

**Incoming call banner** (shown when `callsStore.incomingCalls.length > 0`):
- Green bg-green-50 border border-green-200 rounded-lg
- Caller initials avatar, name, number, queue
- Answer button (green circle, `Phone` icon) + Decline button (red circle, `PhoneOff` icon)

**Active call card** (shown when `callsStore.activeCall !== null`):
- Initials avatar, contact name, number, SLA tier badge, count-up timer (large, brand-primary)
- Control row: Mute | Hold | Transfer | Merge | DTMF | Record | → End (red)
  - Mute toggles: if muted → `useJsSip().mute()`, else `unmute()`, button highlights blue
  - Hold: `holdCall(sessionId)` + `useJsSip().hold()`
  - Transfer: opens transfer modal with agent/queue select
  - Record: `POST /api/recordings` to start recording, button goes red

**Two mini-cards below:**
- Call history today: table of today's CDR (from `listCDR`)
- Queue stats: from `getQueueStats()` → waiting count + avg wait per queue

**Dialpad panel (right):**
- `<DialPad />` component: number input + 3×4 key grid + "Call" button
- "Call" button: calls `useJsSip().makeCall(number)` for PSTN, or `createSession({ transport: 'whatsapp', to: number })` for WhatsApp tab
- Supervisor section (below divider, only if user.role === 'supervisor' or 'admin'):
  - Buttons: "Silent listen", "Whisper", "Barge in"
  - Calls `supervisorListen(sessionId)` / `supervisorWhisper(sessionId)` / `supervisorBarge(sessionId)` from routing API

---

## Wallboard (`src/app/(dashboard)/calling/wallboard/page.tsx`)

Full-width, no secondary sidebar.

**TopBar:** "Realtime wallboard" + pulsing green live dot + "Refreshes every 5s" + queue filter select

**KPI row (5 cards):**
From `getQueueStats()` aggregated:
- Active calls (blue)
- Waiting — amber if > 5
- Agents online/total (green)
- Handled today (neutral)
- Missed today — red if miss rate > 10%

**Queue breakdown (2-col grid):**
For each queue from `listQueues()`: name, avg wait, Waiting / Active / Agents / Handled counts

**Agent states table:**
From `listAgents()` — columns: Agent | State pill | Current call | Duration | Handled today | Supervisor actions
- State pills: Available=green, Busy=amber, Break=pink, Offline=gray
- Supervisor action buttons (Listen/Whisper/Barge) only on Busy rows
- Skeleton while loading, then refetchInterval: 5000

---

## IVR Builder (`src/app/(dashboard)/calling/ivr/page.tsx`)

Layout: `[180px palette+flows] | [flex-1 canvas] | [200px properties]`

**Node palette:**
Node types with colors: Play message (blue) | DTMF menu (green) | Voice bot (amber) | Route to queue (teal) | Condition (purple) | Collect input (pink) | Hangup (red)
Draggable — but for v1 use click-to-add to canvas at a default position.

**Flows list** (below palette, separator):
From `listFlows()` — click to load. "New flow" button creates via `createFlow()`.

**Canvas (`IVRFlowCanvas`):**
- Light gray dotted-grid background (CSS: `background-image: radial-gradient(...)`)
- Nodes as absolutely-positioned white cards with:
  - Colored icon badge, node title, description text
  - Port circles (top = in, bottom = out) for connections
  - Click to select (border-brand-primary)
- SVG overlay for connector lines between nodes
- For v1: render the saved flow's nodes from `getFlow(flowId)` in a preset layout
- Selected node data goes to PropertiesPanel

**Properties panel:**
- Shows fields for selected node type
- Play message: label, TTS text textarea
- DTMF menu: label, prompt text, timeout (number), max retries, key-to-node mapping (rows of key + destination select)
- Route to queue: label, queue select, max wait (number), overflow destination
- All changes via `updateFlow(flowId, nodes)` on save

**TopBar actions:** "Test flow" | "History" | "Publish" — Publish calls `publishFlow(flowId)`

---

## Hooks

`src/lib/hooks/useCalls.ts`:
```ts
export function useActiveSessions() {
  return useQuery({ queryKey: ['activeSessions'], queryFn: listActiveSessions, refetchInterval: 5000 })
}
export function useCDR(filters?: CDRFilters) {
  return useQuery({ queryKey: ['cdr', filters], queryFn: () => listCDR(filters) })
}
```

`src/lib/hooks/useAgentState.ts`:
```ts
export function useAgents() {
  return useQuery({ queryKey: ['agents'], queryFn: listAgents, refetchInterval: 5000 })
}
export function useSetAgentState() {
  return useMutation({ mutationFn: ({ agentId, state }) => setAgentState(agentId, state) })
}
```

---

## Acceptance checklist — verify before STEP 05
- [ ] PhonePanel renders on every page (floating, not inside content)
- [ ] ActiveCallBar appears at top of main content when a call is active
- [ ] IncomingCallToast fires on call.ringing WebSocket event
- [ ] Calling page shows PSTN/WhatsApp tabs with call list
- [ ] Dialpad sends PSTN calls via JsSIP
- [ ] Wallboard table shows agent states with correct color pills
- [ ] Wallboard polls every 5 seconds
- [ ] IVR builder canvas shows nodes with connector lines
- [ ] IVR properties panel updates on node selection
- [ ] No TypeScript errors

✅ Only proceed to STEP 05 once all boxes are checked.
