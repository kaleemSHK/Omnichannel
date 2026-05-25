# STEP 05 — Contacts / CRM
> Paste this entire prompt into Cursor Composer. Do NOT move to STEP 06 until all checks pass.

## What to build

```
src/app/(dashboard)/contacts/page.tsx
src/components/contacts/ContactList.tsx
src/components/contacts/ContactListItem.tsx
src/components/contacts/ContactDetailPanel.tsx
src/components/contacts/ContactForm.tsx
```

## Layout

```
[IconSidebar] | [280px contacts-list] | [flex-1 detail-panel]
```

## Contacts list panel

**Toolbar:**
- `<Input>` with `Search` icon, placeholder "Search contacts…"
  - Debounce 300ms → calls `searchContacts(query)` from `src/lib/api/contacts.ts`
  - While idle (no search): calls `listContacts({ page })` 
- "New contact" button (outline, `UserPlus` icon) → opens `ContactForm` in a Sheet

**Contact list** (infinite scroll):
Each `ContactListItem`:
- Initials avatar (2 chars, deterministic bg color from name hash)
- Full name (font-medium)
- Phone number (text-sm text-muted-foreground)
- Company / account name if available
- SLA tier badge (Gold=amber, Silver=gray, Bronze=orange, right side)
- Selected: blue left border highlight

**Loading:** 3 skeleton rows while fetching.
**Empty state:** "No contacts found" with a search icon illustration.

## Contact detail panel

Renders when a contact is selected. If none selected: show "Select a contact" empty state.

**Header:**
- Large initials avatar (48px, rounded-full)
- Contact name (text-xl font-semibold)
- Company name (text-muted-foreground)
- Action buttons: `Edit` (opens ContactForm Sheet), `Phone` (initiates call via PhonePanel), `MessageSquare` (opens new conversation)

**Info grid (2-column):**
| Label | Value |
|---|---|
| Phone | +968 xxxx xxxx |
| Email | contact@example.com |
| Account ID | CW account ID |
| SLA Tier | Gold/Silver/Bronze badge |
| Plan | Enterprise/Professional |
| Location | City, Country |
| Created | relative date |

Values from `getContact(contactId)`.

**"Recent conversations" section:**
- From `getContactConversations(contactId)` — max 5
- Each row: status badge (Open/Resolved), message snippet, timestamp
- "View all" link → navigates to `/conversations?contact_id=X`

**"Open tickets" section:**
- From `listTickets({ contact_id: contactId, status: 'open' })` — max 5
- Each row: `#TKT-XXXX`, title, priority chip
- "View all" link → `/tickets?contact_id=X`

## ContactForm (Sheet slide-over)

Used for both create and edit (pass `contact?: CWContact` prop).

Fields (react-hook-form + zod):
- Name (required, min 2)
- Email (optional, email format)
- Phone (optional, min 7)
- Company (optional)
- SLA tier (select: Gold / Silver / Bronze)

On save:
- Create: `createContact(data)` → `invalidateQueries(['contacts'])`
- Edit: `updateContact(contactId, data)` → `invalidateQueries(['contact', contactId])`

Use shadcn/ui `Sheet`, `Form`, `Input`, `Select`, `Button`.

## Acceptance checklist — verify before STEP 06
- [ ] Contact list renders with real data
- [ ] Search debounces and filters contacts live
- [ ] Clicking a contact shows the detail panel
- [ ] SLA tier badges show correct colors
- [ ] "New contact" Sheet opens and saves successfully
- [ ] Edit button pre-fills form with contact data
- [ ] Recent conversations section links to /conversations
- [ ] No TypeScript errors

✅ Only proceed to STEP 06 once all boxes are checked.
