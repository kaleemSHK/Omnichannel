# PROMPT 18 — Inbox Admin (Chatwoot) — Professional Full Implementation

## Context

You are working inside the BlinkOne frontend (`frontend/` directory — Next.js 14 App Router, TypeScript strict, Tailwind CSS, shadcn/ui components).

**Golden rules — never break these:**
- NEVER use `localStorage` or `sessionStorage` — tokens live in Zustand memory only
- NEVER call Chatwoot API with raw `fetch` — always use `cwFetch()` from `src/lib/api/client.ts`
- NEVER call BlinkOne sidecar APIs with raw `fetch` — always use `bnFetch()` from `src/lib/api/client.ts`
- Do NOT modify `src/lib/api/client.ts`, `src/types/index.ts`, or any file outside `frontend/` unless explicitly listed below
- All server state via **TanStack Query v5** — no raw `useEffect` for data fetching
- Use `toast` from `sonner` for all success / error / info notifications
- Use `cn()` from `src/lib/utils/cn` for conditional class merging
- RTL-safe layout: use `ms-*` / `me-*` / `ps-*` / `pe-*` instead of `ml-*` / `mr-*` / `pl-*` / `pr-*`
- `text-start` / `text-end` instead of `text-left` / `text-right`
- All interactive elements need `aria-label` where icon-only
- Keyboard navigable: `Tab` cycles all controls, `Escape` closes any open drawer/dialog

---

## What exists today (DO NOT break)

| File | Current state |
|------|--------------|
| `src/components/settings/InboxSection.tsx` | Basic read-only list — icon, name, channel badge, non-functional edit pencil |
| `src/lib/api/conversations.ts` | Has `listInboxes()` — do NOT modify this file |
| `src/lib/demo/inboxesFixture.ts` | 4 demo inboxes (`DEMO_INBOXES`) — extend but do not remove existing entries |
| `src/types/index.ts` | Has `CWInbox { id, name, channel_type, avatar_url?, working_hours_enabled }` — do NOT modify |
| `src/app/(dashboard)/settings/page.tsx` | Renders `<InboxSection />` — do NOT modify |

---

## Files to CREATE

```
src/lib/api/inboxes.ts
src/lib/demo/inboxAdminFixture.ts
src/components/settings/inbox/InboxCreateWizard.tsx
src/components/settings/inbox/InboxEditDrawer.tsx
src/components/settings/inbox/InboxAgentsPanel.tsx
src/components/settings/inbox/InboxDeleteDialog.tsx
src/components/settings/inbox/InboxCard.tsx
src/components/settings/inbox/ChannelConfigFields.tsx
src/components/settings/inbox/WorkingHoursFields.tsx
src/hooks/useInboxAdmin.ts
```

## Files to REPLACE (full rewrite)

```
src/components/settings/InboxSection.tsx   ← becomes the smart shell
```

---

## STEP 1 — Extend types (inline, do NOT touch index.ts)

In `src/lib/api/inboxes.ts`, define these **local** types at the top:

```ts
/** Extended inbox — superset of CWInbox (add fields without touching types/index.ts) */
export interface InboxDetail {
  id: number;
  name: string;
  channel_type: ChannelType;
  avatar_url?: string;
  working_hours_enabled: boolean;
  greeting_message?: string;
  away_message?: string;
  auto_assignment?: boolean;
  csat_survey_enabled?: boolean;
  email?: string;                    // Channel::Email
  phone_number?: string;             // Channel::TwilioSms
  widget_color?: string;             // Channel::WebWidget
  welcome_title?: string;            // Channel::WebWidget
  welcome_tagline?: string;          // Channel::WebWidget
  sip_extension?: string;            // Channel::Voice (BlinkOne custom)
  whatsapp_api_key?: string;         // Channel::Whatsapp (masked on read)
}

export type ChannelType =
  | 'Channel::Whatsapp'
  | 'Channel::Email'
  | 'Channel::WebWidget'
  | 'Channel::TwilioSms'
  | 'Channel::Voice'
  | 'Channel::Api';

export interface InboxMember {
  id: number;
  name: string;
  email: string;
  role: string;
  availability_status: 'online' | 'busy' | 'offline';
  avatar_url?: string;
}

export interface WorkingHoursDay {
  day_of_week: number;   // 0 = Sunday … 6 = Saturday
  closed_all_day: boolean;
  open_hour: number;
  open_minutes: number;
  close_hour: number;
  close_minutes: number;
}
```

---

## STEP 2 — API layer (`src/lib/api/inboxes.ts`)

Import `cwFetch` from `./client` and `useAuthStore` from `@/lib/store/auth`.

```ts
import { cwFetch } from './client';
import { useAuthStore } from '@/lib/store/auth';

function aid() {
  return useAuthStore.getState().user?.chatwootAccountId ?? 0;
}
```

Implement **all** of these functions (no stubs — full implementation):

### `getInbox(id: number): Promise<InboxDetail>`
`GET /accounts/:aid/inboxes/:id`

### `createInbox(data: CreateInboxPayload): Promise<InboxDetail>`
`POST /accounts/:aid/inboxes`

```ts
export interface CreateInboxPayload {
  name: string;
  channel: {
    type: ChannelType;
    // channel-specific fields passed through
    [key: string]: unknown;
  };
  working_hours_enabled?: boolean;
  greeting_message?: string;
  away_message?: string;
  auto_assignment?: boolean;
  csat_survey_enabled?: boolean;
}
```

### `updateInbox(id: number, data: Partial<InboxDetail>): Promise<InboxDetail>`
`PATCH /accounts/:aid/inboxes/:id`

### `deleteInbox(id: number): Promise<void>`
`DELETE /accounts/:aid/inboxes/:id`

### `getInboxMembers(inboxId: number): Promise<InboxMember[]>`
`GET /accounts/:aid/inbox_members/:inboxId`
Response shape: `{ payload: InboxMember[] }` — return `.payload ?? []`

### `updateInboxMembers(inboxId: number, userIds: number[]): Promise<void>`
`POST /accounts/:aid/inbox_members`
Body: `{ inbox_id: inboxId, user_ids: userIds }`

### `getInboxWorkingHours(inboxId: number): Promise<WorkingHoursDay[]>`
`GET /accounts/:aid/inboxes/:inboxId/working_hours`
Response shape: `{ working_hours: WorkingHoursDay[] }`

### `updateInboxWorkingHours(inboxId: number, hours: WorkingHoursDay[]): Promise<void>`
`PATCH /accounts/:aid/inboxes/:inboxId/working_hours`
Body: `{ working_hours: hours }`

### `listAllAgents(): Promise<InboxMember[]>`
`GET /accounts/:aid/agents`
Response shape: `InboxMember[]` (Chatwoot returns array directly)

Each function must wrap errors gracefully — propagate them so React Query can show error state.

---

## STEP 3 — Demo fixtures (`src/lib/demo/inboxAdminFixture.ts`)

```ts
import type { InboxDetail, InboxMember, WorkingHoursDay } from '@/lib/api/inboxes';

export const DEMO_INBOX_DETAILS: Record<number, InboxDetail> = {
  1: {
    id: 1,
    name: 'WhatsApp Support',
    channel_type: 'Channel::Whatsapp',
    working_hours_enabled: true,
    greeting_message: 'Welcome to BlinkOne support! How can we help you today?',
    away_message: 'We are currently away. Our business hours are 9AM–6PM Sun–Thu.',
    auto_assignment: true,
    csat_survey_enabled: true,
    whatsapp_api_key: '••••••••••••',
  },
  2: {
    id: 2,
    name: 'Email Billing',
    channel_type: 'Channel::Email',
    working_hours_enabled: true,
    greeting_message: 'Thanks for reaching out to Billing.',
    away_message: 'We have received your email and will respond within 1 business day.',
    auto_assignment: false,
    csat_survey_enabled: true,
    email: 'billing@labbik.om',
  },
  3: {
    id: 3,
    name: 'Web Chat',
    channel_type: 'Channel::WebWidget',
    working_hours_enabled: false,
    greeting_message: 'Hi there! Ask us anything.',
    auto_assignment: true,
    csat_survey_enabled: false,
    widget_color: '#3B82F6',
    welcome_title: 'BlinkOne Support',
    welcome_tagline: 'We typically reply within a few minutes.',
  },
  4: {
    id: 4,
    name: 'SMS Alerts',
    channel_type: 'Channel::TwilioSms',
    working_hours_enabled: true,
    auto_assignment: false,
    csat_survey_enabled: false,
    phone_number: '+96891234567',
  },
  5: {
    id: 5,
    name: 'Voice / SIP',
    channel_type: 'Channel::Voice',
    working_hours_enabled: true,
    auto_assignment: true,
    csat_survey_enabled: false,
    sip_extension: '100',
  },
};

export const DEMO_ALL_AGENTS: InboxMember[] = [
  { id: 1, name: 'Ahmed Al-Rashidi',  email: 'ahmed@labbik.om',   role: 'agent',      availability_status: 'online' },
  { id: 2, name: 'Sara Al-Balushi',   email: 'sara@labbik.om',    role: 'supervisor', availability_status: 'busy'   },
  { id: 3, name: 'Mohammed Al-Farsi', email: 'mohammed@labbik.om',role: 'agent',      availability_status: 'offline'},
  { id: 4, name: 'Fatima Al-Zaabi',   email: 'fatima@labbik.om',  role: 'agent',      availability_status: 'online' },
  { id: 5, name: 'Khalid Al-Nabhani', email: 'khalid@labbik.om',  role: 'admin',      availability_status: 'online' },
];

export const DEMO_INBOX_MEMBERS: Record<number, InboxMember[]> = {
  1: [DEMO_ALL_AGENTS[0], DEMO_ALL_AGENTS[1]],
  2: [DEMO_ALL_AGENTS[1], DEMO_ALL_AGENTS[4]],
  3: [DEMO_ALL_AGENTS[0], DEMO_ALL_AGENTS[2], DEMO_ALL_AGENTS[3]],
  4: [DEMO_ALL_AGENTS[4]],
  5: [DEMO_ALL_AGENTS[0], DEMO_ALL_AGENTS[1], DEMO_ALL_AGENTS[2]],
};

function defaultHours(): WorkingHoursDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map(d => ({
    day_of_week: d,
    closed_all_day: d === 5 || d === 6,  // Fri/Sat closed (Gulf region default)
    open_hour: 9,
    open_minutes: 0,
    close_hour: 18,
    close_minutes: 0,
  }));
}

export const DEMO_WORKING_HOURS: Record<number, WorkingHoursDay[]> = {
  1: defaultHours(),
  2: defaultHours(),
  3: [0,1,2,3,4,5,6].map(d => ({ day_of_week: d, closed_all_day: false, open_hour: 0, open_minutes: 0, close_hour: 23, close_minutes: 59 })),
  4: defaultHours(),
  5: defaultHours(),
};
```

Also add `id: 5` (Voice/SIP) entry to the **existing** `DEMO_INBOXES` in `src/lib/demo/inboxesFixture.ts`:

```ts
// Append to the existing array:
{
  id: 5,
  name: 'Voice / SIP',
  channel_type: 'Channel::Voice',
  working_hours_enabled: true,
},
```

---

## STEP 4 — Custom hook (`src/hooks/useInboxAdmin.ts`)

Centralise all React Query mutations and queries for inbox administration.

```ts
'use client';

import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as InboxAPI from '@/lib/api/inboxes';
import {
  DEMO_INBOX_DETAILS,
  DEMO_ALL_AGENTS,
  DEMO_INBOX_MEMBERS,
  DEMO_WORKING_HOURS,
} from '@/lib/demo/inboxAdminFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';

export function useInboxDetail(inboxId: number | null) {
  return useQuery({
    queryKey: ['inbox', inboxId],
    enabled: inboxId !== null,
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_INBOX_DETAILS[inboxId!] ?? null;
      return InboxAPI.getInbox(inboxId!);
    },
  });
}

export function useAllAgents() {
  return useQuery({
    queryKey: ['agents', 'all'],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_ALL_AGENTS;
      return InboxAPI.listAllAgents();
    },
  });
}

export function useInboxMembers(inboxId: number | null) {
  return useQuery({
    queryKey: ['inbox-members', inboxId],
    enabled: inboxId !== null,
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_INBOX_MEMBERS[inboxId!] ?? [];
      return InboxAPI.getInboxMembers(inboxId!);
    },
  });
}

export function useInboxWorkingHours(inboxId: number | null) {
  return useQuery({
    queryKey: ['inbox-hours', inboxId],
    enabled: inboxId !== null,
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_WORKING_HOURS[inboxId!] ?? [];
      return InboxAPI.getInboxWorkingHours(inboxId!);
    },
  });
}

export function useCreateInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: InboxAPI.createInbox,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inboxes'] });
      toast.success('Inbox created successfully');
    },
    onError: (e: Error) => toast.error(`Failed to create inbox: ${e.message}`),
  });
}

export function useUpdateInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InboxAPI.InboxDetail> }) =>
      InboxAPI.updateInbox(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['inboxes'] });
      qc.invalidateQueries({ queryKey: ['inbox', vars.id] });
      toast.success('Inbox updated');
    },
    onError: (e: Error) => toast.error(`Failed to update inbox: ${e.message}`),
  });
}

export function useDeleteInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: InboxAPI.deleteInbox,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inboxes'] });
      toast.success('Inbox deleted');
    },
    onError: (e: Error) => toast.error(`Failed to delete inbox: ${e.message}`),
  });
}

export function useUpdateInboxMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inboxId, userIds }: { inboxId: number; userIds: number[] }) =>
      InboxAPI.updateInboxMembers(inboxId, userIds),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['inbox-members', vars.inboxId] });
      toast.success('Agents updated');
    },
    onError: (e: Error) => toast.error(`Failed to update agents: ${e.message}`),
  });
}

export function useUpdateWorkingHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inboxId, hours }: { inboxId: number; hours: InboxAPI.WorkingHoursDay[] }) =>
      InboxAPI.updateInboxWorkingHours(inboxId, hours),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['inbox-hours', vars.inboxId] });
      toast.success('Working hours saved');
    },
    onError: (e: Error) => toast.error(`Failed to save hours: ${e.message}`),
  });
}
```

---

## STEP 5 — Channel icon & label map (`src/components/settings/inbox/InboxCard.tsx`)

A standalone card component used in the list. Replace the inline mapping from the old `InboxSection.tsx`.

```tsx
'use client';

import { MessageSquare, Phone, Mail, Globe, Zap, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { CWInbox } from '@/types';

export const CHANNEL_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  'Channel::Whatsapp':  { label: 'WhatsApp',   Icon: MessageSquare, color: 'bg-green-50 text-green-600'  },
  'Channel::Email':     { label: 'Email',       Icon: Mail,          color: 'bg-blue-50 text-blue-600'    },
  'Channel::WebWidget': { label: 'Web Widget',  Icon: Globe,         color: 'bg-purple-50 text-purple-600'},
  'Channel::TwilioSms': { label: 'SMS',         Icon: Phone,         color: 'bg-amber-50 text-amber-600'  },
  'Channel::Voice':     { label: 'Voice / SIP', Icon: Zap,           color: 'bg-rose-50 text-rose-600'    },
  'Channel::Api':       { label: 'API',         Icon: Bot,           color: 'bg-gray-50 text-gray-600'    },
};

interface InboxCardProps {
  inbox: CWInbox;
  onEdit: (inbox: CWInbox) => void;
  onDelete: (inbox: CWInbox) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export function InboxCard({ inbox, onEdit, onDelete, canEdit, canDelete }: InboxCardProps) {
  const meta = CHANNEL_META[inbox.channel_type] ?? { label: inbox.channel_type, Icon: MessageSquare, color: 'bg-gray-50 text-gray-600' };
  const { Icon, label, color } = meta;

  return (
    <div
      role="listitem"
      className="flex items-center gap-3 border rounded-lg px-4 py-3 bg-white hover:bg-muted/20 transition-colors group"
    >
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon size={16} aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{inbox.name}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <Badge
        variant="outline"
        className={cn('text-xs shrink-0', inbox.working_hours_enabled ? 'border-green-300 text-green-700' : '')}
      >
        {inbox.working_hours_enabled ? 'Business hours' : 'Always on'}
      </Badge>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8"
            aria-label={`Edit ${inbox.name}`}
            onClick={() => onEdit(inbox)}
          >
            <Pencil size={13} />
          </Button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            aria-label={`Delete ${inbox.name}`}
            onClick={() => onDelete(inbox)}
          >
            <Trash2 size={13} />
          </Button>
        )}
      </div>
    </div>
  );
}
```

---

## STEP 6 — Channel-specific config fields (`src/components/settings/inbox/ChannelConfigFields.tsx`)

Rendered inside both the Create wizard and the Edit drawer, conditionally by `channel_type`.

```tsx
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ChannelType } from '@/lib/api/inboxes';

interface Props {
  channelType: ChannelType;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function ChannelConfigFields({ channelType, values, onChange }: Props) {
  switch (channelType) {
    case 'Channel::Email':
      return (
        <Field label="Email address" id="email" type="email" placeholder="support@company.com"
          value={values.email ?? ''} onChange={v => onChange('email', v)} />
      );
    case 'Channel::TwilioSms':
      return (
        <Field label="Phone number (E.164)" id="phone" type="tel" placeholder="+96891234567"
          value={values.phone_number ?? ''} onChange={v => onChange('phone_number', v)} />
      );
    case 'Channel::Whatsapp':
      return (
        <Field label="WhatsApp API key" id="wakey" type="password" placeholder="Enter API key"
          value={values.whatsapp_api_key ?? ''} onChange={v => onChange('whatsapp_api_key', v)} />
      );
    case 'Channel::WebWidget':
      return (
        <div className="space-y-3">
          <Field label="Widget title" id="wtitle" placeholder="Our Support Team"
            value={values.welcome_title ?? ''} onChange={v => onChange('welcome_title', v)} />
          <Field label="Tagline" id="wtagline" placeholder="We reply within minutes"
            value={values.welcome_tagline ?? ''} onChange={v => onChange('welcome_tagline', v)} />
          <div className="space-y-1">
            <Label htmlFor="wcolor" className="text-xs">Widget color</Label>
            <div className="flex items-center gap-2">
              <input
                id="wcolor"
                type="color"
                className="w-10 h-9 rounded border p-1 cursor-pointer"
                value={values.widget_color ?? '#3B82F6'}
                onChange={e => onChange('widget_color', e.target.value)}
              />
              <span className="text-xs text-muted-foreground">{values.widget_color ?? '#3B82F6'}</span>
            </div>
          </div>
        </div>
      );
    case 'Channel::Voice':
      return (
        <Field label="SIP extension" id="sipext" placeholder="e.g. 100"
          value={values.sip_extension ?? ''} onChange={v => onChange('sip_extension', v)} />
      );
    case 'Channel::Api':
      return (
        <p className="text-xs text-muted-foreground italic">
          No additional configuration required for API channel.
        </p>
      );
    default:
      return null;
  }
}

function Field({
  label, id, type = 'text', placeholder, value, onChange,
}: {
  label: string; id: string; type?: string; placeholder?: string;
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
```

---

## STEP 7 — Working Hours fields (`src/components/settings/inbox/WorkingHoursFields.tsx`)

```tsx
'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';
import type { WorkingHoursDay } from '@/lib/api/inboxes';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Props {
  hours: WorkingHoursDay[];
  onChange: (hours: WorkingHoursDay[]) => void;
}

export function WorkingHoursFields({ hours, onChange }: Props) {
  function patch(dayIndex: number, patch: Partial<WorkingHoursDay>) {
    onChange(hours.map((h, i) => (i === dayIndex ? { ...h, ...patch } : h)));
  }

  function fmt(h: number, m: number) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function parseFmt(v: string): { h: number; m: number } {
    const [hh, mm] = v.split(':').map(Number);
    return { h: hh ?? 0, m: mm ?? 0 };
  }

  return (
    <div className="space-y-2">
      {hours.map((day, i) => (
        <div key={day.day_of_week} className={cn('flex items-center gap-3 py-1.5', day.closed_all_day && 'opacity-60')}>
          <Switch
            id={`day-${day.day_of_week}`}
            checked={!day.closed_all_day}
            onCheckedChange={open => patch(i, { closed_all_day: !open })}
            aria-label={DAY_NAMES[day.day_of_week]}
          />
          <Label htmlFor={`day-${day.day_of_week}`} className="w-24 text-sm shrink-0">
            {DAY_NAMES[day.day_of_week]}
          </Label>
          {!day.closed_all_day ? (
            <>
              <input
                type="time"
                className="border rounded px-2 py-1 text-sm w-28"
                value={fmt(day.open_hour, day.open_minutes)}
                onChange={e => { const { h, m } = parseFmt(e.target.value); patch(i, { open_hour: h, open_minutes: m }); }}
                aria-label={`${DAY_NAMES[day.day_of_week]} open time`}
              />
              <span className="text-muted-foreground text-sm">–</span>
              <input
                type="time"
                className="border rounded px-2 py-1 text-sm w-28"
                value={fmt(day.close_hour, day.close_minutes)}
                onChange={e => { const { h, m } = parseFmt(e.target.value); patch(i, { close_hour: h, close_minutes: m }); }}
                aria-label={`${DAY_NAMES[day.day_of_week]} close time`}
              />
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Closed</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## STEP 8 — Delete confirmation dialog (`src/components/settings/inbox/InboxDeleteDialog.tsx`)

```tsx
'use client';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteInbox } from '@/hooks/useInboxAdmin';
import type { CWInbox } from '@/types';

interface Props {
  inbox: CWInbox | null;
  onClose: () => void;
}

export function InboxDeleteDialog({ inbox, onClose }: Props) {
  const { mutate: deleteInbox, isPending } = useDeleteInbox();

  if (!inbox) return null;

  function handleConfirm() {
    deleteInbox(inbox!.id, { onSuccess: onClose });
  }

  return (
    <AlertDialog open={!!inbox} onOpenChange={open => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{inbox.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the inbox and all its configuration.
            Conversations inside this inbox will not be deleted but will lose their inbox association.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-destructive hover:bg-destructive/90 text-white"
          >
            {isPending ? 'Deleting…' : 'Delete inbox'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

## STEP 9 — Agent assignment panel (`src/components/settings/inbox/InboxAgentsPanel.tsx`)

```tsx
'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';
import { Search, Check, UserMinus, UserPlus } from 'lucide-react';
import { useAllAgents, useInboxMembers, useUpdateInboxMembers } from '@/hooks/useInboxAdmin';
import type { InboxMember } from '@/lib/api/inboxes';

const STATUS_DOT: Record<string, string> = {
  online: 'bg-green-500',
  busy: 'bg-amber-500',
  offline: 'bg-gray-400',
};

interface Props {
  inboxId: number;
}

export function InboxAgentsPanel({ inboxId }: Props) {
  const { data: allAgents = [], isLoading: loadingAll } = useAllAgents();
  const { data: members = [], isLoading: loadingMembers } = useInboxMembers(inboxId);
  const { mutate: saveMembers, isPending } = useUpdateInboxMembers();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(() => new Set(members.map(m => m.id)));

  // keep selected in sync when members load
  const memberIds = members.map(m => m.id).join(',');
  useMemo(() => {
    setSelected(new Set(members.map(m => m.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberIds]);

  const filtered = allAgents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase()),
  );

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function save() {
    saveMembers({ inboxId, userIds: Array.from(selected) });
  }

  const isDirty = JSON.stringify([...selected].sort()) !== JSON.stringify(members.map(m => m.id).sort());

  if (loadingAll || loadingMembers) {
    return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-11 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search agents…"
          className="ps-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search agents"
        />
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-1">
        {filtered.length === 0 && (
          <p className="text-sm text-center text-muted-foreground py-6">No agents found</p>
        )}
        {filtered.map(agent => {
          const isSelected = selected.has(agent.id);
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => toggle(agent.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-start text-sm transition-colors',
                isSelected ? 'bg-brand-primary/10' : 'hover:bg-muted/40',
              )}
              aria-pressed={isSelected}
            >
              <div className="relative shrink-0">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center justify-center">
                  {agent.name.slice(0, 2).toUpperCase()}
                </div>
                <span className={cn('absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 rounded-full border-2 border-white', STATUS_DOT[agent.availability_status])} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{agent.name}</p>
                <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
              </div>
              <span className={cn('shrink-0', isSelected ? 'text-brand-primary' : 'text-muted-foreground/30')}>
                {isSelected ? <Check size={15} /> : <UserPlus size={14} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {selected.size} agent{selected.size !== 1 ? 's' : ''} assigned
        </p>
        <Button
          size="sm"
          disabled={!isDirty || isPending}
          onClick={save}
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {isPending ? 'Saving…' : 'Save agents'}
        </Button>
      </div>
    </div>
  );
}
```

---

## STEP 10 — Edit drawer (`src/components/settings/inbox/InboxEditDrawer.tsx`)

A right-side drawer with 3 tabs: **Settings**, **Agents**, **Working Hours**.

```tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelConfigFields } from './ChannelConfigFields';
import { WorkingHoursFields } from './WorkingHoursFields';
import { InboxAgentsPanel } from './InboxAgentsPanel';
import { CHANNEL_META } from './InboxCard';
import {
  useInboxDetail, useUpdateInbox, useInboxWorkingHours, useUpdateWorkingHours,
} from '@/hooks/useInboxAdmin';
import type { CWInbox } from '@/types';
import type { WorkingHoursDay } from '@/lib/api/inboxes';

interface Props {
  inbox: CWInbox | null;
  onClose: () => void;
}

export function InboxEditDrawer({ inbox, onClose }: Props) {
  const { data: detail, isLoading } = useInboxDetail(inbox?.id ?? null);
  const { data: storedHours } = useInboxWorkingHours(inbox?.id ?? null);
  const { mutate: updateInbox, isPending: saving } = useUpdateInbox();
  const { mutate: saveHours, isPending: savingHours } = useUpdateWorkingHours();

  const [name, setName] = useState('');
  const [greeting, setGreeting] = useState('');
  const [away, setAway] = useState('');
  const [autoAssign, setAutoAssign] = useState(false);
  const [csatEnabled, setCsatEnabled] = useState(false);
  const [workingHoursOn, setWorkingHoursOn] = useState(false);
  const [channelValues, setChannelValues] = useState<Record<string, string>>({});
  const [hours, setHours] = useState<WorkingHoursDay[]>([]);

  // Sync form when detail loads
  useEffect(() => {
    if (!detail) return;
    setName(detail.name);
    setGreeting(detail.greeting_message ?? '');
    setAway(detail.away_message ?? '');
    setAutoAssign(detail.auto_assignment ?? false);
    setCsatEnabled(detail.csat_survey_enabled ?? false);
    setWorkingHoursOn(detail.working_hours_enabled);
    setChannelValues({
      email: detail.email ?? '',
      phone_number: detail.phone_number ?? '',
      whatsapp_api_key: detail.whatsapp_api_key ?? '',
      widget_color: detail.widget_color ?? '#3B82F6',
      welcome_title: detail.welcome_title ?? '',
      welcome_tagline: detail.welcome_tagline ?? '',
      sip_extension: detail.sip_extension ?? '',
    });
  }, [detail]);

  useEffect(() => {
    if (storedHours?.length) setHours(storedHours);
  }, [storedHours]);

  if (!inbox) return null;

  const meta = CHANNEL_META[inbox.channel_type] ?? { label: inbox.channel_type };

  function handleSaveSettings() {
    updateInbox({
      id: inbox!.id,
      data: {
        name,
        greeting_message: greeting,
        away_message: away,
        auto_assignment: autoAssign,
        csat_survey_enabled: csatEnabled,
        working_hours_enabled: workingHoursOn,
        ...channelValues,
      },
    }, { onSuccess: onClose });
  }

  function handleSaveHours() {
    saveHours({ inboxId: inbox!.id, hours });
  }

  return (
    <Sheet open={!!inbox} onOpenChange={open => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            {meta.label} — {inbox.name}
          </SheetTitle>
          <SheetDescription className="text-xs">
            Inbox ID #{inbox.id} · {inbox.channel_type}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="settings">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="settings"  className="flex-1 text-xs">Settings</TabsTrigger>
            <TabsTrigger value="agents"    className="flex-1 text-xs">Agents</TabsTrigger>
            <TabsTrigger value="hours"     className="flex-1 text-xs">Working hours</TabsTrigger>
          </TabsList>

          {/* ── Settings tab ── */}
          <TabsContent value="settings" className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-9" />)}</div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="inbox-name" className="text-xs">Inbox name</Label>
                  <Input id="inbox-name" value={name} onChange={e => setName(e.target.value)} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="greeting" className="text-xs">Greeting message</Label>
                  <Textarea
                    id="greeting"
                    rows={2}
                    placeholder="Sent automatically when a conversation starts"
                    value={greeting}
                    onChange={e => setGreeting(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="away" className="text-xs">Away message</Label>
                  <Textarea
                    id="away"
                    rows={2}
                    placeholder="Sent when no agents are available"
                    value={away}
                    onChange={e => setAway(e.target.value)}
                  />
                </div>

                {/* Channel-specific fields */}
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Channel configuration
                  </p>
                  <ChannelConfigFields
                    channelType={detail?.channel_type ?? inbox.channel_type as never}
                    values={channelValues}
                    onChange={(k, v) => setChannelValues(prev => ({ ...prev, [k]: v }))}
                  />
                </div>

                {/* Toggles */}
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Behaviour
                  </p>
                  <Toggle
                    id="auto-assign"
                    label="Auto-assignment"
                    description="Automatically assign new conversations to available agents"
                    checked={autoAssign}
                    onChange={setAutoAssign}
                  />
                  <Toggle
                    id="csat"
                    label="CSAT survey"
                    description="Send a satisfaction survey after conversations are resolved"
                    checked={csatEnabled}
                    onChange={setCsatEnabled}
                  />
                  <Toggle
                    id="working-hours-toggle"
                    label="Business hours"
                    description="Restrict this inbox to your configured working hours"
                    checked={workingHoursOn}
                    onChange={setWorkingHoursOn}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={saving || !name.trim()}
                    className="bg-brand-primary hover:bg-brand-primary/90"
                  >
                    {saving ? 'Saving…' : 'Save settings'}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Agents tab ── */}
          <TabsContent value="agents">
            <InboxAgentsPanel inboxId={inbox.id} />
          </TabsContent>

          {/* ── Working hours tab ── */}
          <TabsContent value="hours" className="space-y-4">
            {hours.length === 0 ? (
              <div className="space-y-2">{[1,2,3,4,5,6,7].map(i => <Skeleton key={i} className="h-9" />)}</div>
            ) : (
              <>
                <WorkingHoursFields hours={hours} onChange={setHours} />
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSaveHours}
                    disabled={savingHours}
                    className="bg-brand-primary hover:bg-brand-primary/90"
                  >
                    {savingHours ? 'Saving…' : 'Save hours'}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Toggle({
  id, label, description, checked, onChange,
}: {
  id: string; label: string; description: string;
  checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
```

---

## STEP 11 — Create wizard (`src/components/settings/inbox/InboxCreateWizard.tsx`)

A 3-step wizard rendered in a `Sheet`:
- **Step 1** — Choose channel type (visual card grid)
- **Step 2** — Name + channel-specific config
- **Step 3** — Assign agents (reuses `InboxAgentsPanel` concept inline)

```tsx
'use client';

import { useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ChannelConfigFields } from './ChannelConfigFields';
import { CHANNEL_META } from './InboxCard';
import { useCreateInbox } from '@/hooks/useInboxAdmin';
import type { ChannelType } from '@/lib/api/inboxes';

const CHANNEL_TYPES: ChannelType[] = [
  'Channel::Whatsapp',
  'Channel::Email',
  'Channel::WebWidget',
  'Channel::TwilioSms',
  'Channel::Voice',
  'Channel::Api',
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InboxCreateWizard({ open, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [channelType, setChannelType] = useState<ChannelType | null>(null);
  const [name, setName] = useState('');
  const [channelValues, setChannelValues] = useState<Record<string, string>>({});
  const { mutate: createInbox, isPending } = useCreateInbox();

  function reset() {
    setStep(1);
    setChannelType(null);
    setName('');
    setChannelValues({});
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleCreate() {
    if (!channelType || !name.trim()) return;
    createInbox(
      {
        name: name.trim(),
        channel: { type: channelType, ...channelValues },
      },
      { onSuccess: handleClose },
    );
  }

  const STEPS = ['Channel', 'Details', 'Review'];

  return (
    <Sheet open={open} onOpenChange={o => !o && handleClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-2">
          <SheetTitle className="text-base">New inbox</SheetTitle>
          <SheetDescription className="text-xs">Connect a new channel to BlinkOne</SheetDescription>
        </SheetHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={cn(
                'w-6 h-6 rounded-full text-xs font-medium flex items-center justify-center transition-colors',
                step > i + 1  ? 'bg-brand-primary text-white' :
                step === i + 1 ? 'bg-brand-primary text-white ring-2 ring-brand-primary/30' :
                'bg-muted text-muted-foreground',
              )}>
                {i + 1}
              </div>
              <span className={cn('text-xs', step === i + 1 ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                {s}
              </span>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-border mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 1 — Choose channel */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Select a channel type</p>
            <div className="grid grid-cols-2 gap-2">
              {CHANNEL_TYPES.map(ct => {
                const { label, Icon, color } = CHANNEL_META[ct] ?? { label: ct, Icon: () => null, color: 'bg-gray-50 text-gray-600' };
                return (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setChannelType(ct)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all text-sm font-medium',
                      channelType === ct
                        ? 'border-brand-primary bg-brand-primary/5'
                        : 'border-border hover:border-brand-primary/40 hover:bg-muted/30',
                    )}
                    aria-pressed={channelType === ct}
                  >
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
                      <Icon size={20} />
                    </div>
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end pt-2">
              <Button
                disabled={!channelType}
                onClick={() => setStep(2)}
                className="bg-brand-primary hover:bg-brand-primary/90"
              >
                Next <ChevronRight size={15} className="ms-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Name + channel config */}
        {step === 2 && channelType && (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="new-inbox-name" className="text-xs">Inbox name *</Label>
              <Input
                id="new-inbox-name"
                placeholder={`e.g. ${CHANNEL_META[channelType]?.label ?? 'My'} Support`}
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Channel configuration
              </p>
              <ChannelConfigFields
                channelType={channelType}
                values={channelValues}
                onChange={(k, v) => setChannelValues(prev => ({ ...prev, [k]: v }))}
              />
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft size={15} className="me-1" /> Back
              </Button>
              <Button
                disabled={!name.trim()}
                onClick={() => setStep(3)}
                className="bg-brand-primary hover:bg-brand-primary/90"
              >
                Next <ChevronRight size={15} className="ms-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Review & create */}
        {step === 3 && channelType && (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Summary</p>
              <div className="flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', CHANNEL_META[channelType]?.color)}>
                  {(() => { const Icon = CHANNEL_META[channelType]?.Icon; return Icon ? <Icon size={16} /> : null; })()}
                </div>
                <div>
                  <p className="font-medium text-sm">{name}</p>
                  <p className="text-xs text-muted-foreground">{CHANNEL_META[channelType]?.label}</p>
                </div>
              </div>
              {Object.entries(channelValues).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex gap-2 text-xs">
                  <span className="text-muted-foreground capitalize w-28 shrink-0">{k.replace(/_/g, ' ')}</span>
                  <span className="truncate">{k.includes('key') ? '••••••••' : v}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              You can assign agents and configure working hours after creation.
            </p>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft size={15} className="me-1" /> Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isPending}
                className="bg-brand-primary hover:bg-brand-primary/90"
              >
                {isPending ? 'Creating…' : 'Create inbox'}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

---

## STEP 12 — RBAC guard helper (inline in InboxSection.tsx)

```ts
// Allowed actions per role
// admin / platform_admin → full CRUD
// supervisor → edit (no create/delete)
// agent → read only

function useInboxPermissions() {
  const user = useAuthStore(s => s.user);
  const role = user?.role ?? 'agent';
  return {
    canCreate: role === 'admin' || role === 'platform_admin',
    canEdit:   role !== 'agent',
    canDelete: role === 'admin' || role === 'platform_admin',
  };
}
```

---

## STEP 13 — Full rewrite: `src/components/settings/InboxSection.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listInboxes } from '@/lib/api/conversations';
import { DEMO_INBOXES } from '@/lib/demo/inboxesFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { useAuthStore } from '@/lib/store/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Inbox } from 'lucide-react';
import { InboxCard, CHANNEL_META } from './inbox/InboxCard';
import { InboxEditDrawer } from './inbox/InboxEditDrawer';
import { InboxDeleteDialog } from './inbox/InboxDeleteDialog';
import { InboxCreateWizard } from './inbox/InboxCreateWizard';
import type { CWInbox } from '@/types';

// ── RBAC ──────────────────────────────────────────────────────────────────────
function useInboxPermissions() {
  const user = useAuthStore(s => s.user);
  const role = (user as { role?: string } | null)?.role ?? 'agent';
  return {
    canCreate: role === 'admin' || role === 'platform_admin',
    canEdit:   role !== 'agent',
    canDelete: role === 'admin' || role === 'platform_admin',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export function InboxSection() {
  const { canCreate, canEdit, canDelete } = useInboxPermissions();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [editingInbox, setEditingInbox] = useState<CWInbox | null>(null);
  const [deletingInbox, setDeletingInbox] = useState<CWInbox | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: inboxes = [], isLoading } = useQuery({
    queryKey: ['inboxes'],
    queryFn: async () => {
      try {
        const data = await listInboxes();
        return data.length ? data : isDemoDataEnabled() ? DEMO_INBOXES : [];
      } catch {
        return isDemoDataEnabled() ? DEMO_INBOXES : [];
      }
    },
    staleTime: 30_000,
  });

  // Unique channel types for filter tabs
  const channelTypes = ['all', ...Array.from(new Set(inboxes.map(i => i.channel_type)))];

  const filtered = inboxes.filter(inbox => {
    const matchSearch =
      inbox.name.toLowerCase().includes(search.toLowerCase()) ||
      (CHANNEL_META[inbox.channel_type]?.label ?? '').toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || inbox.channel_type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Inboxes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage connected channels — {inboxes.length} inbox{inboxes.length !== 1 ? 'es' : ''} total
          </p>
        </div>
        {canCreate && (
          <Button
            className="bg-brand-primary hover:bg-brand-primary/90 shrink-0"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={14} className="me-1.5" />
            New inbox
          </Button>
        )}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search inboxes…"
            className="ps-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search inboxes"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {channelTypes.map(ct => {
            const label = ct === 'all' ? 'All' : (CHANNEL_META[ct]?.label ?? ct);
            return (
              <button
                key={ct}
                type="button"
                onClick={() => setFilterType(ct)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterType === ct
                    ? 'bg-brand-primary text-white'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
                aria-pressed={filterType === ct}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Inbox list */}
      <div role="list" className="space-y-2">
        {isLoading
          ? [1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)
          : filtered.length === 0
          ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Inbox size={20} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No inboxes found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {search || filterType !== 'all'
                    ? 'Try adjusting your search or filter'
                    : canCreate
                    ? 'Create your first inbox to get started'
                    : 'No inboxes have been configured yet'}
                </p>
              </div>
              {canCreate && !search && filterType === 'all' && (
                <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-brand-primary hover:bg-brand-primary/90">
                  <Plus size={14} className="me-1.5" /> New inbox
                </Button>
              )}
            </div>
          )
          : filtered.map(inbox => (
            <InboxCard
              key={inbox.id}
              inbox={inbox}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={setEditingInbox}
              onDelete={setDeletingInbox}
            />
          ))}
      </div>

      {/* Stats footer */}
      {!isLoading && inboxes.length > 0 && (
        <div className="border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {filtered.length} of {inboxes.length} inboxes</span>
          <span>{inboxes.filter(i => i.working_hours_enabled).length} with business hours</span>
        </div>
      )}

      {/* Panels */}
      <InboxCreateWizard open={createOpen} onClose={() => setCreateOpen(false)} />
      <InboxEditDrawer inbox={editingInbox} onClose={() => setEditingInbox(null)} />
      <InboxDeleteDialog inbox={deletingInbox} onClose={() => setDeletingInbox(null)} />
    </div>
  );
}
```

---

## STEP 14 — Checklist before finishing

Go through every item in this checklist and verify it is satisfied:

- [ ] `src/lib/api/inboxes.ts` — all 8 API functions implemented using `cwFetch` only
- [ ] All mutations use `useQueryClient().invalidateQueries` with correct query keys
- [ ] `isDemoDataEnabled()` checked in every query function — demo returns fixture data, never calls API
- [ ] `DEMO_INBOXES` in `inboxesFixture.ts` has Voice/SIP entry added (id: 5)
- [ ] `DEMO_INBOX_DETAILS` covers ids 1–5
- [ ] `InboxSection.tsx` imports from `@/lib/api/conversations` (NOT inboxes.ts) for `listInboxes`
- [ ] `InboxCard` uses `ms-*`/`me-*` spacing, `text-start`/`text-end` — zero `ml`/`mr`/`pl`/`pr`
- [ ] All icon-only `<Button>` elements have `aria-label`
- [ ] `Sheet` from shadcn/ui closes on `Escape` key (it does by default — do not suppress this)
- [ ] `AlertDialog` has explicit Cancel + destructive Confirm with loading state
- [ ] `WorkingHoursFields` shows Gulf-region default (Fri/Sat closed) for new inboxes
- [ ] TypeScript strict — no `any`, no untyped catch blocks (use `(e: Error)` or `unknown`)
- [ ] No `useEffect` for data fetching — TanStack Query only
- [ ] No `localStorage` or `sessionStorage` anywhere
- [ ] No raw `fetch` calls — all via `cwFetch`
- [ ] `toast.success` on every successful mutation, `toast.error` on every failure
- [ ] RBAC: `canCreate/canEdit/canDelete` guard all buttons and actions

---

## Acceptance criteria

1. The Inboxes tab renders the full inbox list with channel icon, name, channel type badge, and business-hours badge.
2. Search field filters inboxes live by name and channel label.
3. Channel type filter pills filter the list; active pill is highlighted.
4. Clicking **Edit (pencil)** on any card opens the `InboxEditDrawer` with Settings, Agents, and Working Hours tabs pre-populated.
5. Saving settings fires `PATCH /accounts/:id/inboxes/:inboxId` and invalidates the `['inboxes']` query.
6. Saving agents fires `POST /accounts/:id/inbox_members` and shows toast.
7. Saving working hours fires `PATCH /accounts/:id/inboxes/:inboxId/working_hours` and shows toast.
8. Clicking the **trash icon** opens the `AlertDialog`; confirming fires `DELETE` with loading state.
9. Clicking **+ New inbox** opens the 3-step `InboxCreateWizard`; step indicator updates correctly.
10. Step 1 requires a channel type to be selected before proceeding.
11. Step 2 shows channel-specific fields (email, phone, API key, widget color, SIP extension).
12. Step 3 shows a review summary; API keys are masked with bullets.
13. Demo mode: all fixtures load, all mutations show toasts but do not call real API.
14. Admin/platform_admin role: sees + New inbox, pencil, and trash.
15. Supervisor role: sees pencil only (no create/delete buttons).
16. Agent role: sees list only — no edit or delete controls.
17. RTL (Arabic): all spacing/alignment uses logical CSS properties — layout mirrors correctly.
18. Keyboard: Tab cycles all interactive elements; Escape closes any open drawer or dialog.
19. Empty state renders with appropriate message and (if admin) a CTA to create the first inbox.
20. Stats footer shows count of visible vs total inboxes and count with business hours enabled.
