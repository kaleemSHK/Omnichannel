# CURSOR PROMPT — STEP 03: Conversations Inbox
> Paste this ENTIRE file into Cursor Composer. Verify every checkbox before moving to PROMPT_04.

---

Read `.cursorrules` before writing anything.

## Files to create:
```
src/app/(dashboard)/conversations/page.tsx
src/components/conversations/ConversationList.tsx
src/components/conversations/ConversationListItem.tsx
src/components/conversations/MessageThread.tsx
src/components/conversations/MessageBubble.tsx
src/components/conversations/ReplyBox.tsx
src/components/conversations/AgentAssistPanel.tsx
src/lib/hooks/useConversations.ts
```

---

## Layout

```
[52px IconSidebar] | [280px ConversationList] | [flex-1 MessageThread] | [300px AgentAssistPanel — collapsible]
```

Full height: `h-screen flex overflow-hidden` with children `overflow-hidden`

---

## `src/lib/hooks/useConversations.ts`

```ts
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { listConversations, getMessages } from '@/lib/api/conversations'
import type { ConversationFilters } from '@/types'

export function useConversations(filters: ConversationFilters) {
  return useInfiniteQuery({
    queryKey: ['conversations', filters],
    queryFn: ({ pageParam = 1 }) =>
      listConversations({ ...filters, page: pageParam as number }),
    getNextPageParam: (last) => last.meta?.next_page ?? undefined,
    initialPageParam: 1,
  })
}

export function useMessages(conversationId: number | null) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => getMessages(conversationId!),
    enabled: !!conversationId,
  })
}
```

---

## `src/app/(dashboard)/conversations/page.tsx`

```tsx
'use client'
import { useState } from 'react'
import { ConversationList } from '@/components/conversations/ConversationList'
import { MessageThread } from '@/components/conversations/MessageThread'
import { AgentAssistPanel } from '@/components/conversations/AgentAssistPanel'
import type { CWConversation } from '@/types'

export default function ConversationsPage() {
  const [selectedConversation, setSelectedConversation] = useState<CWConversation | null>(null)
  const [assistOpen, setAssistOpen] = useState(true)

  return (
    <div className="flex h-full overflow-hidden">
      <ConversationList
        selectedId={selectedConversation?.id ?? null}
        onSelect={setSelectedConversation}
      />
      <MessageThread
        conversation={selectedConversation}
        onToggleAssist={() => setAssistOpen((v) => !v)}
        assistOpen={assistOpen}
      />
      {assistOpen && selectedConversation && (
        <AgentAssistPanel conversationId={selectedConversation.id} />
      )}
    </div>
  )
}
```

---

## `src/components/conversations/ConversationList.tsx`

'use client' component.

Props:
```ts
interface Props {
  selectedId: number | null
  onSelect: (conv: CWConversation) => void
}
```

Structure:
- Outer: `w-[280px] border-r flex flex-col h-full`
- TopBar (`border-b p-3 space-y-2`):
  - `<Input>` with `Search` icon, placeholder "Search…", controlled value
  - Status tabs: All | Open | Pending | Resolved (use shadcn Tabs or simple button group)
    - Active tab: `border-b-2 border-brand-primary text-brand-primary font-medium`
- List area (`flex-1 overflow-y-auto`):
  - Use `useConversations({ status: activeTab === 'all' ? undefined : activeTab })`
  - While loading (isLoading): render 3 `<Skeleton className="h-16 mx-3 my-1 rounded-lg" />`
  - Error: `<div className="p-4 text-sm text-destructive">Failed to load. <button onClick={() => refetch()}>Retry</button></div>`
  - Data: flatten pages → render `ConversationListItem` per conversation
  - Infinite scroll: IntersectionObserver on a sentinel div at bottom → call `fetchNextPage()`

---

## `src/components/conversations/ConversationListItem.tsx`

Props: `conversation: CWConversation`, `selected: boolean`, `onClick: () => void`

```tsx
// Initials helper
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}
```

Layout (`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors`):
- Selected: `bg-blue-50 border-l-2 border-brand-primary`
- Hover: `hover:bg-muted`
- Left: initials avatar `w-9 h-9 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center justify-center shrink-0`
- Right (flex-1 min-w-0):
  - Row 1: contact name `font-medium text-sm truncate` + timestamp `text-xs text-muted-foreground ms-auto shrink-0`
  - Row 2: inbox badge `text-xs bg-muted px-1.5 py-0.5 rounded` + unread count badge (bg-brand-primary text-white text-xs rounded-full px-1.5) if > 0
  - Row 3: message snippet `text-sm text-muted-foreground truncate`

Timestamp relative function:
```ts
function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}
```

---

## `src/components/conversations/MessageThread.tsx`

'use client'

Props:
```ts
interface Props {
  conversation: CWConversation | null
  onToggleAssist: () => void
  assistOpen: boolean
}
```

Empty state (conversation === null): centered "Select a conversation" with MessageSquare icon.

When conversation selected:
- Outer: `flex flex-col flex-1 h-full overflow-hidden`
- TopBar (`h-12 border-b flex items-center gap-3 px-4 shrink-0`):
  - Initials avatar (same as list item)
  - Contact name `font-medium text-sm`
  - Inbox badge
  - `<Select>` for agent assignment → `assignConversation(conv.id, agentId)` (mutation)
  - Status button: if open → "Resolve" (outline), if resolved → "Reopen" (outline-green)
    - `updateConversationStatus(conv.id, status)` mutation → invalidateQueries(['conversations'])
  - Chevron button (`ChevronRight` when assistOpen=true, `ChevronLeft` when false) → onToggleAssist
- Messages area (`flex-1 overflow-y-auto flex flex-col gap-2 px-4 py-4`):
  - Use `useMessages(conversation.id)`
  - Skeleton 4 rows while loading
  - Map messages → `<MessageBubble>` per message
  - Activity events (type !== 'incoming'/'outgoing'): centered `<div className="text-xs text-center text-muted-foreground py-1">`
  - Auto-scroll to bottom on new messages (useEffect with ref)
- `<ReplyBox conversationId={conversation.id} />`

Realtime: on mount, call `subscribeToConversation(accountId, conversation.id, { onMessage: () => queryClient.invalidateQueries(['messages', conversation.id]) })`
Get accountId from `useAuthStore().user.account_id`

---

## `src/components/conversations/MessageBubble.tsx`

Props: `message: CWMessage`

```tsx
const isOutbound = message.message_type === 'outgoing'

return (
  <div className={cn('flex gap-2 max-w-[75%]', isOutbound ? 'ms-auto flex-row-reverse' : 'me-auto')}>
    {!isOutbound && (
      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center shrink-0 mt-1">
        {/* initials from message.sender.name */}
      </div>
    )}
    <div>
      <div className={cn(
        'rounded-lg px-3 py-2 text-sm',
        isOutbound
          ? 'bg-blue-50 border border-blue-100 rounded-tr-none'
          : 'bg-muted rounded-tl-none'
      )}>
        <p dir="auto">{message.content}</p>
        {/* attachment links if any */}
      </div>
      <p className="text-xs text-muted-foreground mt-1 px-1">{relativeTime(message.created_at)}</p>
    </div>
  </div>
)
```

---

## `src/components/conversations/ReplyBox.tsx`

'use client'

Props: `conversationId: number`

```tsx
import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sendMessage } from '@/lib/api/conversations'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { SendHorizontal, Paperclip } from 'lucide-react'
import { toast } from 'sonner'

export function ReplyBox({ conversationId }: { conversationId: number }) {
  const [content, setContent] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => sendMessage(conversationId, { content, message_type: 'outgoing' }),
    onSuccess: () => {
      setContent('')
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to send'),
  })

  function handleSend() {
    if (!content.trim()) return
    mutation.mutate()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t p-3 flex gap-2 items-end shrink-0">
      <Button variant="ghost" size="icon" className="shrink-0 mb-0.5">
        <Paperclip className="w-4 h-4" />
      </Button>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Reply… (Enter to send, Shift+Enter for newline)"
        className="min-h-[40px] max-h-32 resize-none flex-1"
        rows={1}
      />
      <Button
        onClick={handleSend}
        disabled={!content.trim() || mutation.isPending}
        className="bg-brand-primary hover:bg-brand-primary/90 shrink-0 mb-0.5"
        size="icon"
      >
        <SendHorizontal className="w-4 h-4" />
      </Button>
    </div>
  )
}
```

---

## `src/components/conversations/AgentAssistPanel.tsx`

'use client'

Props: `conversationId: number`

Outer: `w-[300px] border-s flex flex-col h-full overflow-y-auto bg-muted/30`

Three collapsible sections (use shadcn Collapsible or simple useState toggle):

### Section 1 — Suggested Reply
```tsx
const { data: suggestion, isLoading } = useQuery({
  queryKey: ['suggestReply', conversationId],
  queryFn: () => suggestReply(conversationId),
  enabled: !!conversationId,
})
```
- Section header: "Suggested reply" + `ChevronDown`/`ChevronUp` toggle
- Content: gray card `bg-background border rounded-md p-3 text-sm` with suggestion text
- "Insert" button (outline, small) at bottom → must set ReplyBox content
  (Use a global store or event bus: `window.dispatchEvent(new CustomEvent('insert-reply', { detail: suggestion.content }))`)
  In ReplyBox, listen to this event via `useEffect`

### Section 2 — Knowledge Sources
```tsx
// Auto-query on last message text (pass lastMessage as prop or derive from store)
const { data: ragResults } = useQuery({
  queryKey: ['ragQuery', conversationId],
  queryFn: () => queryRAG({ query: lastInboundMessage, top_k: 3 }),
  enabled: !!lastInboundMessage,
})
```
- Section header: "Knowledge sources"
- Each result: score badge `bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full` (e.g. "94% match"), source title, 2-line text snippet

### Section 3 — Sentiment & Summary
- Section header: "AI Insights"
- Sentiment badge: Positive=`bg-green-50 text-green-700`, Neutral=`bg-gray-100 text-gray-600`, Negative=`bg-red-50 text-red-700`
- "Summarize" Button (outline full-width) → `summarizeConversation(conversationId)` mutation → shows result in shadcn Dialog

---

## CHECKLIST — verify every item before moving to PROMPT_04:
- [ ] Conversation list renders with real data from API (or skeleton while loading)
- [ ] Status tabs (All/Open/Pending/Resolved) filter the list
- [ ] Clicking a conversation loads the message thread
- [ ] Arabic messages render RTL correctly (`dir="auto"` on `<p>`)
- [ ] Outbound messages right-aligned blue-50, inbound left-aligned gray
- [ ] Sending a message (Enter key or send button) adds it to thread
- [ ] "Resolve" button changes conversation status
- [ ] AgentAssistPanel slides in/out when chevron clicked
- [ ] Suggested reply "Insert" button fills the ReplyBox textarea
- [ ] `npm run type-check` → 0 errors

✅ All checked? Paste PROMPT_04 into Composer.
