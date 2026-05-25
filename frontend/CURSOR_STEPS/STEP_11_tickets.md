# STEP 11 — Tickets
> Paste this entire prompt into Cursor Composer. Do NOT move to STEP 12 until all checks pass.

## What to build

```
src/app/(dashboard)/tickets/page.tsx
src/components/tickets/TicketNav.tsx
src/components/tickets/TicketList.tsx
src/components/tickets/TicketListItem.tsx
src/components/tickets/TicketDetail.tsx
src/components/tickets/TicketThread.tsx
src/components/tickets/TicketReplyBox.tsx
src/components/tickets/NewTicketModal.tsx
```

## Layout

```
[IconSidebar] | [190px tickets-nav] | [300px ticket-list] | [flex-1 ticket-detail]
```

## Tickets Nav

**Views:**
- All open — badge with total open count
- High priority — red badge
- Assigned to me
- Resolved

**Teams:**
- Sales
- Support
- Billing

Clicking a view/team sets the filter for the ticket list.

## Ticket list

**Toolbar:** status filter (All/Open/Pending/Resolved) + priority filter (All/High/Medium/Low) dropdowns

From `listTickets({ status, priority, assigned_to, team })` — `GET /api/tickets/v1/tickets`

Each `TicketListItem`:
- `#TKT-XXXX` in muted text-xs
- Priority chip: High=red-100/red-700, Medium=amber-100/amber-700, Low=gray
- Title (font-medium, 1-line truncate)
- Status chip (Open=blue, Pending=amber, Resolved=green)
- Contact name + SLA tier
- Timestamp (relative)
- Selected: blue left border

## Ticket detail panel

Renders when ticket selected. Show "Select a ticket" empty state otherwise.

**Header:**
- Ticket title (text-lg font-semibold)
- Row of chips: status | priority | contact name (linked) | assignee name
- Action buttons: "Change status" select, "Reassign" button

**Info grid (2-column cards):**
- Created at
- SLA deadline — red text if breached
- Inbox type
- Contact → clickable link to /contacts
- Related conversation → clickable link

**Conversation thread (`TicketThread`):**
From `getTicketMessages(ticketId)` — `GET /api/tickets/v1/tickets/{id}/messages`

Messages displayed as a timeline:
- Avatar (initials), author name, timestamp
- Message text (dir="auto" for Arabic)
- Inbound (contact): left-aligned, gray bg
- Outbound (agent): right-aligned, blue-50 bg

**Reply box (`TicketReplyBox`):**
- `<Textarea>` placeholder "Reply…"
- "Send" button → `createTicketMessage(ticketId, { content })` → `invalidateQueries(['ticketMessages', ticketId])`
- "Close & reply" button → sends message + resolves ticket simultaneously

## NewTicketModal (shadcn Dialog)

Fields:
- Subject (required)
- Contact (searchable select, calls `searchContacts`)
- Assignee (select from agents)
- Priority (select: High/Medium/Low)
- Team (select)
- Description (textarea)

On save: `createTicket(data)` → `invalidateQueries(['tickets'])`

---

## Acceptance checklist — verify before STEP 12
- [ ] Ticket list filters by status and priority
- [ ] Clicking a ticket shows the detail panel
- [ ] Thread displays correctly with RTL support for Arabic
- [ ] Sending a reply adds it to the thread
- [ ] New ticket modal creates and appears in list
- [ ] SLA deadline shows red when breached
- [ ] No TypeScript errors

✅ Only proceed to STEP 12 once all boxes are checked.
