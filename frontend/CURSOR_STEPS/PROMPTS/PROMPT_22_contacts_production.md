# PROMPT 22 — Contacts Module: Production Finalization

## Context — read before touching any file

**Stack**: Next.js 14 App Router · Chatwoot v4 REST API · TanStack Query v5 · Zustand · Tailwind  
**API clients** (NEVER raw fetch):
- `cwFetch()` → `/_cw/*` → Chatwoot, `api_access_token` header
- `bnFetch()` → `/_gw/*` → BlinkOne gateway, Bearer JWT

**RTL**: `ms-*`/`me-*`/`ps-*`/`pe-*` only — zero `ml-*`/`mr-*`/`pl-*`/`pr-*`  
**Sheet**: `@/components/ui/Sheet` (capital S, project custom) — NOT shadcn sheet  
**Demo mode**: `isDemoDataEnabled()` → return fixture, never hit real API  
**RBAC**: `can(role, feature)` from `@/lib/rbac`  
**No localStorage** — Zustand or TanStack Query only

---

## Bug Inventory — 15 issues identified

### CRITICAL

**BUG-01 · `ContactsWorkspace.tsx` — `useContactsList('')` called at workspace level solely to auto-select first contact; creates a duplicate inflight query**  
Line 17: `const { data } = useContactsList('');` — this fires a second infinite query purely to find the first contact ID. `ContactList` already calls `useContactsList(debounced)` with its own query. Both queries share the same cache key when `debounced === ''`, so the data is shared, but the hook is called twice at the component level unnecessarily. If `ContactList` internal debounce starts at `''`, these two queries fire simultaneously creating two inflight requests. Fix: remove the call from `ContactsWorkspace` — instead lift "first-contact auto-select" into `ContactList` via a callback (`onFirstContact?: (id: number) => void`) called inside `ContactList` once data arrives.

**BUG-02 · `ContactDetailPanel.tsx` — "View conversations" link uses `?contact_id=` which only works in demo**  
Lines 91, 120, 132: `href={/conversations?contact_id=${contact.id}}` — as identified in PROMPT_21 BUG-01, the conversations page deep-link was updated to accept `?conversation_id=`. The contacts module must now pass the actual conversation ID. Fix: from `useContactConversations`, use the real conversation `id` in the link: `href={/conversations?conversation_id=${c.id}}`. For the generic "Message" button (line 91), navigate to `/conversations` without a param — the agent will select the conversation manually. Or, use the first open conversation id if available.

**BUG-03 · `ContactForm.tsx` — `createContact` does NOT save `custom_attributes` (sla_tier, company)**  
Line 87-91: `create.mutateAsync({ name, email, phone_number })` — the `sla_tier` and `company` fields collected by the form are NOT passed to `createContact`. Only `updateContact` includes `custom_attributes`. Fix: extend `createContact` API function to accept `custom_attributes` and pass the full payload on create as well.

**BUG-04 · `ContactForm.tsx` — `updateContact` sends `company` inside `custom_attributes` but Chatwoot expects company as a top-level `company_name` field**  
Line 76-81: the payload sends `custom_attributes: { company: values.company }`. Chatwoot's contacts API uses `company_name: string` at the root level (not nested in custom_attributes) to set the company. Fix: change payload to `{ ..., company_name: values.company || undefined, custom_attributes: { sla_tier: values.sla_tier } }`.

**BUG-05 · `useContactsList` — on API failure, silently falls back to demo fixture in production**  
Lines 43-49: when `listContacts` or `searchContacts` throws, the catch block returns demo fixture data without any error signal to the UI. In production this means a network error shows fake Oman contacts to real users. Fix: in production (non-demo) mode, re-throw the error so TanStack Query marks the query as `isError = true` and `ContactList` can show a proper "Failed to load" state with Retry.

**BUG-06 · `useContactConversations` — demo fixture returns hardcoded inline objects, not typed `CWConversation`**  
Lines 83-87: the demo returns `[{ id: 1, status: 'open', messages: [...] }]` — these anonymous objects don't match `CWConversation` shape (missing `inbox_id`, `last_activity_at`, `unread_count`, `labels`, `channel`). `ContactDetailPanel` accesses `c.last_activity_at` on line 142 — this is `undefined` for demo data, causing silent rendering gaps. Fix: return properly shaped demo conversations from `DEMO_CONVERSATIONS` in `conversationsFixture.ts` instead of inline objects.

**BUG-07 · `ContactDetailPanel.tsx` — `useJsSip()` called at component level; registers a SIP UA on every contact detail view**  
Line 31: `const { makeCall } = useJsSip();` — `useJsSip` initialises the JsSIP UA on mount. Calling it in `ContactDetailPanel` means a UA is created/destroyed every time the user switches contacts. Fix: use the shared `makeCall` from the existing singleton in the calls store, or call `useCallsStore.getState().makeCall` via a wrapper rather than spinning up a new hook instance.

**BUG-08 · `ContactDetailPanel.tsx` — phone number stripped of all non-digits including `+`**  
Line 53: `contact.phone_number?.replace(/\D/g, '') ?? ''` — strips the `+` prefix. International SIP calls require E.164 format (`+96891234567`). Asterisk/Kamailio needs the `+`. Fix: preserve `+` — use `contact.phone_number?.replace(/[^\d+]/g, '') ?? ''`.

**BUG-09 · `ContactDetailPanel.tsx` — "Account ID" field shows the agent's own Chatwoot accountId, not the contact's account**  
Line 103: `<Info label="Account ID" value={accountId ? String(accountId) : '—'} />` — `accountId` is from `useAuthStore` — it is the logged-in agent's Chatwoot account number, not anything related to the contact. This is misleading. Fix: remove this field entirely, or replace with `contact.id` displayed as "Contact ID", or the contact's `identifier` field if set.

### PRODUCTION / UX

**BUG-10 · `ContactListItem.tsx` — selected border uses non-existent Tailwind class `border-s-brand-primary`**  
Line 28: `'bg-blue-50 border-s-brand-primary'` — Tailwind does not auto-generate `border-s-*` variants for custom CSS variables unless explicitly configured in `tailwind.config`. The selected state likely renders with no visible border. Fix: use `border-s-[var(--brand-primary)]` or the equivalent configured class (check project tailwind config — if `brand-primary` is configured as a colour alias use `border-s-brand-primary` only if it is listed there, otherwise use the inline CSS variable form).

**BUG-11 · `ContactList.tsx` — `IntersectionObserver` re-creates on every `contacts.length` change**  
Lines 34-41: the effect depends on `[fetchNextPage, hasNextPage, contacts.length]`. Every time a new page loads (`contacts.length` changes), the observer is torn down and recreated. This causes a brief gap where the sentinel may intersect but no load is triggered. Fix: use a stable `ref` callback (same pattern as PROMPT_21's `sentinelCallback`) so the observer is only re-created when `hasNextPage` changes.

**BUG-12 · `ContactForm.tsx` — no loading/disabled state during form submission for `update` mutation**  
Line 142-148: `disabled={isSubmitting}` only covers `react-hook-form`'s submission state. But `update.mutateAsync` can remain pending after `handleSubmit` resolves (async). Add `update.isPending || create.isPending` to the disabled condition.

**BUG-13 · `ContactDetailPanel.tsx` — conversation link (line 132) navigates to `/conversations?contact_id=` for each conversation row, not to the specific conversation**  
Every conversation row links to the same URL — the contact_id filter. Agents clicking different conversations always land on the same conversations list without auto-selecting the specific one. Fix: link each row directly to `?conversation_id=${c.id}` (after PROMPT_21 fix is in place).

**BUG-14 · `ContactDetailPanel.tsx` — Delete contact action is missing entirely**  
There is no delete button anywhere in the contacts UI. Chatwoot provides `DELETE /accounts/:id/contacts/:contactId`. Production apps require this. Fix: add a "Delete contact" button (destructive, confirmation required, admin/supervisor only via `can(role, 'manageTeam')`) and the corresponding `deleteContact` API function + `useDeleteContact` mutation.

**BUG-15 · `ContactsWorkspace.tsx` — no import/export capability**  
Chatwoot supports `GET /accounts/:id/contacts.csv` for export and `POST /accounts/:id/contacts/import` with a CSV file upload. Production contact management requires bulk operations. Fix: add an "Export CSV" button (downloads contacts as CSV) and an "Import CSV" button (file picker → POST to import endpoint) in the `ContactList` header area.

---

## Implementation Steps

### Step 1 — Extend `src/lib/api/contacts.ts`

Add `deleteContact`, extend `createContact`, fix `updateContact`, add import/export:

```ts
/** DELETE contact */
export async function deleteContact(id: number): Promise<void> {
  await cwFetch<void>(`/accounts/${accountId()}/contacts/${id}`, {
    method: 'DELETE',
  });
}

/** Export contacts as CSV — returns blob URL */
export async function exportContactsCsv(): Promise<Blob> {
  const res = await fetch(`/_cw/api/v1/accounts/${accountId()}/contacts.csv`, {
    headers: {
      api_access_token: useAuthStore.getState().user?.chatwootToken ?? '',
    },
  });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}

/** Import contacts via CSV file */
export async function importContactsCsv(file: File): Promise<void> {
  const fd = new FormData();
  fd.append('import_file', file);
  await cwFetch<void>(`/accounts/${accountId()}/contacts/import`, {
    method: 'POST',
    body: fd,
    headers: {}, // let browser set multipart boundary
  });
}

/** Updated createContact with custom_attributes support */
export async function createContact(data: {
  name: string;
  email?: string;
  phone_number?: string;
  company_name?: string;
  custom_attributes?: Record<string, string>;
}): Promise<CWContact> {
  return cwFetch<CWContact>(`/accounts/${accountId()}/contacts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

---

### Step 2 — Fix `src/lib/hooks/useContacts.ts`

**Fix BUG-05** — production errors must surface, not silently return demo data:

```ts
export function useContactsList(search: string) {
  const trimmed = search.trim();
  return useInfiniteQuery({
    queryKey: ['contacts', trimmed || 'all', isDemoDataEnabled()],
    queryFn: async ({ pageParam = 1 }) => {
      if (isDemoDataEnabled()) {
        const all = filterDemoContacts(trimmed);
        const start = ((pageParam as number) - 1) * PAGE_SIZE;
        return { contacts: all.slice(start, start + PAGE_SIZE), page: pageParam as number };
      }
      // Production: let errors bubble up — do NOT silently fall back to demo
      const res = trimmed
        ? await searchContacts(trimmed, pageParam as number)
        : await listContacts(pageParam as number);
      const contacts = parseContactsList(res);
      return { contacts, page: pageParam as number };
    },
    initialPageParam: 1,
    getNextPageParam: (last, _all, lastPage) =>
      last.contacts.length >= PAGE_SIZE ? (lastPage as number) + 1 : undefined,
  });
}
```

**Fix BUG-06** — real demo conversations:

```ts
import { DEMO_CONVERSATIONS } from '@/lib/demo/conversationsFixture';

export function useContactConversations(contactId: number | null) {
  return useQuery({
    queryKey: ['contact-conversations', contactId, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) {
        // Return typed demo conversations matching this contact's sender id
        return DEMO_CONVERSATIONS.filter(
          c => c.meta?.sender?.id === contactId,
        ).slice(0, 5);
      }
      try {
        const res = await getContactConversations(contactId!);
        const payload = (res as { payload?: unknown[] }).payload ?? [];
        return payload.slice(0, 5) as Array<{
          id: number;
          status?: string;
          last_activity_at?: number;
          messages?: { content?: string }[];
        }>;
      } catch {
        return [];
      }
    },
    enabled: contactId != null,
  });
}
```

**Add `useDeleteContact` and `useImportContacts` mutations**:

```ts
export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteContact,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useImportContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importContactsCsv,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}
```

**Fix `useCreateContact` to pass full payload (BUG-03)**:

```ts
export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createContact>[0]) => createContact(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}
```

---

### Step 3 — Fix `src/components/contacts/ContactForm.tsx` (BUG-03, BUG-04, BUG-12)

Update `onSubmit` to fix both create and update payloads:

```ts
const onSubmit = async (values: FormValues) => {
  try {
    if (isEdit && contact) {
      // BUG-04 fix: company_name at root level, sla_tier in custom_attributes
      await update.mutateAsync({
        id: contact.id,
        data: {
          name: values.name,
          email: values.email || undefined,
          phone_number: values.phone_number || undefined,
          company_name: values.company || undefined,    // ← root level
          custom_attributes: { sla_tier: values.sla_tier },
        },
      });
      toast.success('Contact updated');
    } else {
      // BUG-03 fix: pass custom_attributes on create too
      await create.mutateAsync({
        name: values.name,
        email: values.email || undefined,
        phone_number: values.phone_number || undefined,
        company_name: values.company || undefined,
        custom_attributes: { sla_tier: values.sla_tier },
      });
      toast.success('Contact created');
    }
    onDone();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Save failed');
  }
};
```

Fix disabled state (BUG-12):

```tsx
<Button
  type="submit"
  disabled={isSubmitting || create.isPending || update.isPending}
  className="w-full bg-brand-primary hover:bg-brand-primary/90"
>
  {(isSubmitting || create.isPending || update.isPending) && (
    <Loader2 size={16} className="animate-spin me-2" />
  )}
  {isEdit ? 'Save changes' : 'Create contact'}
</Button>
```

---

### Step 4 — Fix `src/components/contacts/ContactDetailPanel.tsx` (BUG-02, BUG-07, BUG-08, BUG-09, BUG-13, BUG-14)

**Fix BUG-07** — remove `useJsSip()` from this component; use the calls store action directly:

```tsx
// Remove: import { useJsSip } from '@/lib/hooks/useJsSip';
// Remove: const { makeCall } = useJsSip();

// Add:
import { useCallsStore } from '@/lib/store/calls';
const makeCall = useCallsStore(s => s.makeCall);
// Note: if makeCall is not yet on the store, import it from the singleton:
// import { makeCall } from '@/lib/hooks/useJsSip';
// and call it directly (it's a stable module-level export, not a hook)
```

**Fix BUG-08** — preserve `+` in phone number:

```ts
const phone = contact.phone_number?.replace(/[^\d+]/g, '') ?? '';
```

**Fix BUG-09** — remove misleading "Account ID" field, replace with "Contact ID":

```tsx
// Replace:
// <Info label="Account ID" value={accountId ? String(accountId) : '—'} />
// With:
<Info label="Contact ID" value={String(contact.id)} />
```

**Fix BUG-02** — "Message" button links to conversations without contact_id param:

```tsx
<Link
  href="/conversations"
  className="p-2 rounded-lg border border-gray-200 hover:bg-muted"
  title="Open conversations"
>
  <MessageSquare size={16} className="text-brand-primary" />
</Link>
```

**Fix BUG-13** — each conversation row links to specific conversation:

```tsx
{conversations.slice(0, 5).map(c => (
  <Link
    key={c.id}
    href={`/conversations?conversation_id=${c.id}`}   // ← specific conversation
    className="block py-2 border-b border-gray-50 last:border-0 hover:bg-muted/50 rounded px-1"
  >
    <div className="flex items-center gap-2">
      <span className={cn(
        'px-1.5 py-0.5 rounded text-[10px] font-medium capitalize',
        c.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700',
      )}>
        {c.status ?? 'open'}
      </span>
      {c.last_activity_at != null && (
        <span className="text-xs text-muted-foreground ms-auto">
          {formatRelativeDate(c.last_activity_at)}
        </span>
      )}
    </div>
    <p className="text-xs text-muted-foreground truncate mt-0.5">
      {(c as { messages?: { content?: string }[] }).messages?.[0]?.content?.replace(/\s+/g, ' ') ?? 'No preview'}
    </p>
  </Link>
))}
```

**Fix BUG-14** — add Delete button (admin only):

```tsx
import { useDeleteContact } from '@/lib/hooks/useContacts';
import { can } from '@/lib/rbac';
import { useAuthStore } from '@/lib/store/auth';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

// In component:
const role = useAuthStore(s => s.user?.role);
const deleteMutation = useDeleteContact();
const router = useRouter();
const [confirmDelete, setConfirmDelete] = useState(false);

// Add to action button row:
{can(role, 'manageTeam') && (
  <button
    type="button"
    className="p-2 rounded-lg border border-red-200 hover:bg-red-50 disabled:opacity-50"
    title="Delete contact"
    disabled={deleteMutation.isPending}
    onClick={() => setConfirmDelete(true)}
  >
    <Trash2 size={16} className="text-red-500" />
  </button>
)}

// Confirmation dialog (add below the main div):
{confirmDelete && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-xl p-6 w-80 shadow-xl">
      <h3 className="font-semibold text-base mb-2">Delete contact?</h3>
      <p className="text-sm text-muted-foreground mb-4">
        This will permanently delete <strong>{displayName}</strong> and cannot be undone.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={deleteMutation.isPending}
          onClick={() => {
            deleteMutation.mutate(contact.id, {
              onSuccess: () => {
                setConfirmDelete(false);
                router.push('/contacts');
              },
              onError: (err) => {
                toast.error(err instanceof Error ? err.message : 'Delete failed');
                setConfirmDelete(false);
              },
            });
          }}
        >
          {deleteMutation.isPending ? (
            <Loader2 size={14} className="animate-spin me-1" />
          ) : (
            <Trash2 size={14} className="me-1" />
          )}
          Delete
        </Button>
      </div>
    </div>
  </div>
)}
```

---

### Step 5 — Fix `src/components/contacts/ContactListItem.tsx` (BUG-10)

Check `tailwind.config.ts` — if `brand-primary` is not registered as a border colour extension, replace the class:

```tsx
// Replace:
// 'bg-blue-50 border-s-brand-primary'
// With:
'bg-blue-50 border-s-[var(--brand-primary,#0B5FFF)]'
```

Also add `aria-selected` and `role`:

```tsx
<button
  type="button"
  role="option"
  aria-selected={selected}
  aria-label={`${displayName}${contact.phone_number ? ', ' + contact.phone_number : ''}${contact.company?.name ? ', ' + contact.company.name : ''}`}
  onClick={onSelect}
  className={cn(
    'w-full text-start px-3 py-2.5 flex gap-2.5 border-s-2 transition-colors',
    selected
      ? 'bg-blue-50 border-s-[var(--brand-primary,#0B5FFF)]'
      : 'border-s-transparent hover:bg-muted',
  )}
>
```

---

### Step 6 — Fix `src/components/contacts/ContactList.tsx` (BUG-01, BUG-11)

Add `onFirstContact` callback and fix the stable observer:

```tsx
interface Props {
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNewContact: () => void;
  onFirstContact?: (id: number) => void;  // ← ADD
}

export function ContactList({ selectedId, onSelect, onNewContact, onFirstContact }: Props) {
  // ... existing state ...

  // Notify parent of first contact once (BUG-01)
  const notified = useRef(false);
  useEffect(() => {
    if (notified.current || !onFirstContact) return;
    const first = contacts[0];
    if (first) {
      notified.current = true;
      onFirstContact(first.id);
    }
  }, [contacts, onFirstContact]);

  // Stable sentinel observer (BUG-11) — ref callback pattern
  const obsRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((el: HTMLDivElement | null) => {
    obsRef.current?.disconnect();
    if (!el || !hasNextPage) return;
    obsRef.current = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
    });
    obsRef.current.observe(el);
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // ... rest of component ...

  // Add error state:
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useContactsList(debounced);

  // In JSX, after isLoading block:
  {isError && !isLoading && (
    <div className="p-4 text-sm text-destructive text-center">
      Failed to load contacts.{' '}
      <button type="button" className="underline" onClick={() => void refetch()}>
        Retry
      </button>
    </div>
  )}
```

---

### Step 7 — Fix `src/components/contacts/ContactsWorkspace.tsx` (BUG-01)

Remove duplicate `useContactsList('')` call; use `onFirstContact` callback:

```tsx
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useContact } from '@/lib/hooks/useContacts';
import { ContactList } from '@/components/contacts/ContactList';
import { ContactDetailPanel } from '@/components/contacts/ContactDetailPanel';
import { ContactForm } from '@/components/contacts/ContactForm';
import { Sheet } from '@/components/ui/Sheet';
import type { CWContact } from '@/types';

export function ContactsWorkspace() {
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editContact, setEditContact] = useState<CWContact | undefined>();

  // Deep-link from URL (supports both contact_id and direct id params)
  useEffect(() => {
    const fromUrl = searchParams.get('contact_id');
    if (fromUrl) {
      const id = Number(fromUrl);
      if (Number.isFinite(id) && id > 0) setSelectedId(id);
    }
  }, [searchParams]);

  // Auto-select first contact from list — no duplicate query (BUG-01)
  const handleFirstContact = useCallback((id: number) => {
    setSelectedId(prev => prev ?? id);
  }, []);

  const openCreate = () => {
    setEditContact(undefined);
    setSheetOpen(true);
  };

  const openEdit = (contact: CWContact) => {
    setEditContact(contact);
    setSheetOpen(true);
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)] overflow-hidden bg-surface-tertiary">
      <ContactList
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNewContact={openCreate}
        onFirstContact={handleFirstContact}
      />
      <div className="flex-1 bg-white min-w-0">
        <ContactDetailPanel contactId={selectedId} onEdit={openEdit} />
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editContact ? 'Edit contact' : 'New contact'}
      >
        <ContactForm contact={editContact} onDone={() => setSheetOpen(false)} />
      </Sheet>
    </div>
  );
}
```

---

### Step 8 — Add Import/Export to `ContactList.tsx` (BUG-15)

Add to the header section, alongside the "New contact" button:

```tsx
import { Download, Upload } from 'lucide-react';
import { useImportContacts } from '@/lib/hooks/useContacts';
import { exportContactsCsv } from '@/lib/api/contacts';
import { toast } from 'sonner';
import { useRef as useFileRef } from 'react';
import { can } from '@/lib/rbac';
import { useAuthStore } from '@/lib/store/auth';

// In component:
const role = useAuthStore(s => s.user?.role);
const importMutation = useImportContacts();
const csvInputRef = useFileRef<HTMLInputElement>(null);

async function handleExport() {
  try {
    const blob = await exportContactsCsv();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('Export failed');
  }
}

function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = '';
  importMutation.mutate(file, {
    onSuccess: () => toast.success('Contacts imported successfully'),
    onError: err => toast.error(err instanceof Error ? err.message : 'Import failed'),
  });
}

// In JSX, in the header div after "New contact" button:
<div className="flex gap-2">
  <input
    ref={csvInputRef}
    type="file"
    accept=".csv"
    className="hidden"
    onChange={handleImportFile}
  />
  <button
    type="button"
    title="Export contacts as CSV"
    onClick={handleExport}
    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-muted transition-colors"
  >
    <Download size={14} /> Export
  </button>
  {can(role, 'manageTeam') && (
    <button
      type="button"
      title="Import contacts from CSV"
      disabled={importMutation.isPending}
      onClick={() => csvInputRef.current?.click()}
      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
    >
      <Upload size={14} />
      {importMutation.isPending ? 'Importing…' : 'Import'}
    </button>
  )}
</div>
```

---

### Step 9 — Verification Checklist

- [ ] **BUG-01**: DevTools → Network shows exactly ONE `contacts?page=1` request on load (not two)
- [ ] **BUG-02**: "Message" button on ContactDetailPanel navigates to `/conversations` (no contact_id param)
- [ ] **BUG-03**: Creating a new contact with SLA tier "Gold" → Chatwoot shows `custom_attributes.sla_tier: gold` on that contact
- [ ] **BUG-04**: Editing a contact's company → Chatwoot shows the company linked on the contact (not buried in custom_attributes)
- [ ] **BUG-05**: With API down (demo off), ContactList shows "Failed to load contacts. Retry" — not Oman demo data
- [ ] **BUG-06**: Demo mode: switching to contact 101 (Amina Al-Rashidi) shows the conversation from `DEMO_CONVERSATIONS` with correct status, channel, and last_activity_at
- [ ] **BUG-07**: Network tab shows NO SIP REGISTER request when navigating to Contacts page
- [ ] **BUG-08**: Clicking the Call button on a contact with phone `+968 9211 3344` — outgoing call dialstring is `+96892113344` (with `+`, no spaces)
- [ ] **BUG-09**: ContactDetailPanel shows "Contact ID: 101" not "Account ID: 3" (the account number)
- [ ] **BUG-10**: Selected contact in list shows a visible colored left border (confirm visually in browser)
- [ ] **BUG-11**: Scrolling to bottom of a 50+ contact list → next page loads smoothly without observer errors in console
- [ ] **BUG-12**: Click "Save changes" while update is in flight → button is disabled, no double-submit
- [ ] **BUG-13**: Each conversation row in ContactDetailPanel links to `/conversations?conversation_id=<specific_id>`
- [ ] **BUG-14**: Logged in as admin — Delete button visible. Clicking → confirmation dialog. Confirming → contact removed, redirected to `/contacts`
- [ ] **BUG-15**: Export button downloads a `.csv` file with contacts data. Import button (admin) accepts `.csv`, uploads, invalidates contacts list

---

## Acceptance Criteria

1. Contact list loads with skeleton states, paginates smoothly via infinite scroll
2. Search debounces 300 ms; passes `?q=` to Chatwoot API in production; filters fixture in demo
3. Creating a contact saves name, email, phone, company, and SLA tier correctly in Chatwoot
4. Updating a contact correctly sets company via `company_name` and SLA via `custom_attributes.sla_tier`
5. Deleting a contact requires confirmation and is restricted to admin/supervisor roles
6. Phone call from ContactDetailPanel uses E.164 format (preserves `+`)
7. Conversation links navigate to specific conversation by ID
8. Import CSV: valid CSV imports contacts, toast confirms success, list refreshes
9. Export CSV: downloads all contacts as `.csv` named with today's date
10. No SIP UA created when browsing contacts
11. Production API errors shown as error state with Retry — no silent demo data fallback

---

## Files Modified (summary)

| File | Changes |
|------|---------|
| `src/lib/api/contacts.ts` | Add `deleteContact`, `exportContactsCsv`, `importContactsCsv`; fix `createContact` to accept `custom_attributes` |
| `src/lib/hooks/useContacts.ts` | BUG-05 production error surfacing; BUG-06 typed demo conversations; add `useDeleteContact`, `useImportContacts`; fix `useCreateContact` signature |
| `src/components/contacts/ContactForm.tsx` | BUG-03 create passes custom_attributes; BUG-04 company_name at root; BUG-12 disabled state |
| `src/components/contacts/ContactDetailPanel.tsx` | BUG-02 message link; BUG-07 remove useJsSip; BUG-08 phone format; BUG-09 remove account ID; BUG-13 specific conversation links; BUG-14 delete button |
| `src/components/contacts/ContactListItem.tsx` | BUG-10 border class fix; aria-selected, aria-label |
| `src/components/contacts/ContactList.tsx` | BUG-01 onFirstContact callback; BUG-11 stable observer; BUG-15 import/export; error state |
| `src/components/contacts/ContactsWorkspace.tsx` | BUG-01 remove duplicate query; use onFirstContact |
