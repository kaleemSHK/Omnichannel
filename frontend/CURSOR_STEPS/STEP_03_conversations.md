# STEP 03 — Conversations Inbox
> Paste this entire prompt into Cursor Composer. Do NOT move to STEP 04 until all checks pass.

## What to build

Full conversation inbox screen. This is the primary screen agents use all day.

## Files to create

```
src/app/(dashboard)/conversations/page.tsx
src/components/conversations/ConversationList.tsx
src/components/conversations/ConversationListItem.tsx
src/components/conversations/MessageThread.tsx
src/components/conversations/MessageBubble.tsx
src/components/conversations/ReplyBox.tsx
src/components/conversations/AgentAssistPanel.tsx
src/lib/hooks/useConversations.ts   (if not already created)
```

## Layout (3-panel)

```
[IconSidebar 52px] | [ConversationList 280px] | [MessageThread flex-1] | [AgentAssistPanel 300px collapsible]
```
Full height minus 48px topbar.

## ConversationList panel

- Top: search `<Input>` + status filter tabs: All / Open / Pending / Resolved
  - Tabs use `useQuery` with `queryKey: ['conversations', { status }]`
  - API: `listConversations({ status, page: 1 })` from `src/lib/api/conversations.ts`
- Each `ConversationListItem`:
  - Initials avatar (2 chars from contact name, bg-blue-100 text-blue-700)
  - Contact name (font-medium), inbox badge (type label, small)
  - Message snippet (text-sm text-muted-foreground, truncated 1 line)
  - Timestamp (relative: "2m ago", "1h ago") right-aligned
  - Unread badge (count, bg-brand-primary text-white, rounded-full) if unread_count > 0
  - Selected: `bg-blue-50 border-l-2 border-brand-primary`
- Infinite scroll: load next page when user scrolls near bottom
- Skeleton loading (3 skeleton rows) while first fetch is in flight

## MessageThread panel (when conversation selected)

- TopBar (h-12 border-b):
  - Contact name + avatar
  - Inbox badge
  - `<Select>` for agent assignment → `assignConversation(conversationId, agentId)`
  - Status toggle button (Open → Resolve / Reopen) → `updateConversationStatus()`
  - Chevron button to toggle AgentAssistPanel
- Message list (flex-col, overflow-y-auto, reverse scroll — newest at bottom):
  - Each `MessageBubble`: 
    - Inbound: left-aligned, bg-muted, rounded-lg rounded-tl-none
    - Outbound: right-aligned, bg-blue-50 border border-blue-100, rounded-lg rounded-tr-none
    - `dir="auto"` on the text `<p>` — critical for Arabic
    - Attachments: show filename + download link
    - Timestamp below bubble
  - Activity events (conversation opened, assigned, resolved) as centered gray text rows
- ReplyBox (border-t, p-3):
  - `<Textarea>` for message (auto-resize)
  - Send button (brand-primary, `SendHorizontal` icon)
  - Attachment button
  - Calls `sendMessage(conversationId, { content, message_type: 'outgoing' })`
  - `useMutation` → on success: `invalidateQueries(['messages', conversationId])`
- Realtime: `subscribeToConversation(accountId, conversationId, { onMessage })` on mount
  - New messages append immediately (optimistic update)

## AgentAssistPanel (collapsible right panel)

Only renders when a conversation is selected. Collapse via sliding animation.

Three sections (each collapsible):

**Suggested reply** (`queryKey: ['suggestReply', conversationId]`)
- Call `suggestReply(conversationId)` from `src/lib/api/ai.ts`
- Show the suggested text in a gray card
- "Insert" button → sets ReplyBox textarea value to the suggestion

**RAG sources** (`queryKey: ['ragQuery', lastMessage]`)
- Auto-query on last inbound message
- Show 2-3 source cards: score badge (blue), source title, text snippet
- Score as percentage: e.g. "94% match"

**Sentiment** 
- Show Positive (green) / Neutral (gray) / Negative (red) badge
- "Summarize conversation" button → calls `summarizeConversation(conversationId)` and shows result in modal

## Hooks

`src/lib/hooks/useConversations.ts`:
```ts
export function useConversations(filters: ConversationFilters) {
  return useInfiniteQuery({
    queryKey: ['conversations', filters],
    queryFn: ({ pageParam = 1 }) => listConversations({ ...filters, page: pageParam }),
    getNextPageParam: (last) => last.meta.next_page ?? undefined,
  })
}

export function useMessages(conversationId: number) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => getMessages(conversationId),
    enabled: !!conversationId,
  })
}
```

## Acceptance checklist — verify before STEP 04
- [ ] Conversation list renders with real data (or skeleton while loading)
- [ ] Clicking a conversation loads the message thread
- [ ] Arabic messages display RTL with Noto Sans Arabic
- [ ] Sending a message adds it to the thread immediately
- [ ] Status toggle works (Open ↔ Resolved)
- [ ] AgentAssistPanel collapses and expands
- [ ] Suggested reply "Insert" button fills the reply box
- [ ] No TypeScript errors

✅ Only proceed to STEP 04 once all boxes are checked.
