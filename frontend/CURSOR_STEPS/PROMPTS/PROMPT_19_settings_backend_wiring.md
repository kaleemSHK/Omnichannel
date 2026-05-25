# PROMPT 19 — Settings: Full Backend Wiring

## What this prompt does

Every settings section must talk to the **real backend** — Chatwoot v4 REST API (via `cwFetch`) and the BlinkOne gateway (via `bnFetch`). Demo-mode fallbacks stay in place; they must never be removed. This prompt wires the remaining sections that are still using `useState`-only mock state, fixes the error-handling pattern so all sections degrade gracefully, and adds the missing Chatwoot API functions.

---

## Architecture recap — read before touching anything

```
Browser (Next.js)
  │
  ├─ cwFetch(path)         → /_cw/api/v1/...  → [Next.js rewrite] → Chatwoot :3000
  │    header: api_access_token = tokens.accessToken
  │
  └─ bnFetch(svc, path)    → /_gw/api/{svc}/...→ [Next.js rewrite] → BlinkOne gateway :80
       header: Authorization: Bearer tokens.gatewayJwt
```

**Golden rules — never break:**
- NEVER raw `fetch` — always `cwFetch` (Chatwoot) or `bnFetch` (gateway sidecar)
- NEVER `localStorage` / `sessionStorage`
- Do NOT modify `src/types/index.ts` or `src/lib/api/client.ts`
- All data fetching via **TanStack Query v5** — no raw `useEffect`
- `isDemoDataEnabled()` checked in every `queryFn` — demo data returned first, API never called in demo mode
- Mutations in demo mode: simulate with `settingsDemoDelay()` + return fixture data — never call real API
- `toast.success` on every success, `toast.error` on every failure
- RTL-safe: `ms-*`/`me-*`/`ps-*`/`pe-*` — no `ml-*`/`mr-*`/`pl-*`/`pr-*`
- TypeScript strict — no `any`

---

## STEP 1 — Add missing API functions to `src/lib/api/settings.ts`

Append the following to the **end** of the existing file. Do NOT remove or modify any existing functions.

```ts
// ─── Webhooks (Chatwoot) ─────────────────────────────────────────────────────
// Chatwoot v4: GET/POST/DELETE /api/v1/accounts/:id/integrations/webhooks

export interface CWWebhook {
  id: number;
  url: string;
  subscriptions: string[];   // Chatwoot calls them "subscriptions", not "events"
}

export async function listWebhooks(): Promise<CWWebhook[]> {
  const res = await cwFetch<CWWebhook[] | { payload?: CWWebhook[] }>(
    `/accounts/${aid()}/integrations/webhooks`,
  );
  return Array.isArray(res) ? res : (res.payload ?? []);
}

export async function createWebhook(data: {
  url: string;
  subscriptions: string[];
}): Promise<CWWebhook> {
  return cwFetch(`/accounts/${aid()}/integrations/webhooks`, {
    method: 'POST',
    body: JSON.stringify({ webhook: data }),
  });
}

export async function updateWebhook(
  id: number,
  data: { url?: string; subscriptions?: string[] },
): Promise<CWWebhook> {
  return cwFetch(`/accounts/${aid()}/integrations/webhooks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ webhook: data }),
  });
}

export async function deleteWebhook(id: number): Promise<void> {
  return cwFetch(`/accounts/${aid()}/integrations/webhooks/${id}`, { method: 'DELETE' });
}

// ─── Profile (Chatwoot) ──────────────────────────────────────────────────────
// Chatwoot v4: GET/PUT /api/v1/profile

export interface CWProfile {
  id: number;
  name: string;
  email: string;
  phone_number?: string;
  avatar_url?: string;
  availability_status: 'online' | 'busy' | 'offline';
  display_name?: string;
}

export async function getProfile(): Promise<CWProfile> {
  return cwFetch('/profile');
}

export async function updateProfile(data: {
  name?: string;
  email?: string;
  phone_number?: string;
  display_name?: string;
  password?: string;
  password_confirmation?: string;
  current_password?: string;
}): Promise<CWProfile> {
  return cwFetch('/profile', { method: 'PUT', body: JSON.stringify(data) });
}

export async function updateAvailability(
  availability: 'online' | 'busy' | 'offline',
): Promise<CWProfile> {
  return cwFetch('/profile', {
    method: 'PUT',
    body: JSON.stringify({ availability: availability }),
  });
}

// ─── Notifications (Chatwoot) ────────────────────────────────────────────────
// Chatwoot v4: GET/PUT /api/v1/profile/notifications

export interface NotificationPreferences {
  notification_type: string;
  email: boolean;
  push: boolean;
}

export async function getNotificationPreferences(): Promise<{
  selected_email_flags: string[];
  selected_push_flags: string[];
}> {
  return cwFetch('/profile/notifications');
}

export async function updateNotificationPreferences(data: {
  notifications: { notification_type: string; email: boolean; push: boolean }[];
}): Promise<void> {
  return cwFetch('/profile/notifications', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ─── Business Hours (Chatwoot Account) ──────────────────────────────────────
// Chatwoot v4: GET/PUT /api/v1/accounts/:id/business_hours

export interface BusinessHourEntry {
  closed_all_day: boolean;
  day_of_week: number;   // 0=Sun … 6=Sat
  name: string;
  open_hour: number;
  open_minutes: number;
  close_hour: number;
  close_minutes: number;
}

export async function getBusinessHours(): Promise<BusinessHourEntry[]> {
  const res = await cwFetch<BusinessHourEntry[] | { working_hours?: BusinessHourEntry[] }>(
    `/accounts/${aid()}/business_hours`,
  );
  return Array.isArray(res) ? res : (res.working_hours ?? []);
}

export async function updateBusinessHours(hours: BusinessHourEntry[]): Promise<void> {
  return cwFetch(`/accounts/${aid()}/business_hours`, {
    method: 'PUT',
    body: JSON.stringify({ working_hours: hours }),
  });
}

// ─── Integrations — Chatwoot App list ────────────────────────────────────────
// Chatwoot v4: GET /api/v1/accounts/:id/integrations/apps

export interface CWIntegrationApp {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
}

export async function listIntegrationApps(): Promise<{ payload: CWIntegrationApp[] }> {
  const res = await cwFetch<{ payload: CWIntegrationApp[] } | CWIntegrationApp[]>(
    `/accounts/${aid()}/integrations/apps`,
  );
  if (Array.isArray(res)) return { payload: res };
  return { payload: res.payload ?? [] };
}
```

---

## STEP 2 — Add demo fixtures to `src/lib/demo/settingsFixture.ts`

Append the following to the **end** of the existing fixture file:

```ts
// ─── Webhooks ────────────────────────────────────────────────────────────────
import type { CWWebhook, CWProfile, BusinessHourEntry } from '@/lib/api/settings';

export const DEMO_WEBHOOKS: CWWebhook[] = [
  {
    id: 1,
    url: 'https://n8n.labbik.om/webhook/blinkone',
    subscriptions: ['conversation_created', 'conversation_status_changed', 'message_created'],
  },
  {
    id: 2,
    url: 'https://hooks.zapier.com/hooks/catch/12345/abcde',
    subscriptions: ['conversation_resolved'],
  },
];

// ─── Profile ─────────────────────────────────────────────────────────────────
export const DEMO_PROFILE: CWProfile = {
  id: 1,
  name: 'Ahmed Al-Rashidi',
  email: 'ahmed@labbik.om',
  phone_number: '+96891234567',
  avatar_url: undefined,
  availability_status: 'online',
  display_name: 'Ahmed',
};

// ─── Notification prefs ───────────────────────────────────────────────────────
export const DEMO_NOTIFICATION_PREFS = {
  selected_email_flags: ['conversation_creation', 'conversation_assignment', 'mention'],
  selected_push_flags:  ['conversation_creation', 'conversation_assignment'],
};

// ─── Business hours ───────────────────────────────────────────────────────────
export const DEMO_BUSINESS_HOURS: BusinessHourEntry[] = [
  { day_of_week: 0, name: 'Sunday',    closed_all_day: true,  open_hour: 9, open_minutes: 0, close_hour: 18, close_minutes: 0 },
  { day_of_week: 1, name: 'Monday',    closed_all_day: false, open_hour: 9, open_minutes: 0, close_hour: 18, close_minutes: 0 },
  { day_of_week: 2, name: 'Tuesday',   closed_all_day: false, open_hour: 9, open_minutes: 0, close_hour: 18, close_minutes: 0 },
  { day_of_week: 3, name: 'Wednesday', closed_all_day: false, open_hour: 9, open_minutes: 0, close_hour: 18, close_minutes: 0 },
  { day_of_week: 4, name: 'Thursday',  closed_all_day: false, open_hour: 9, open_minutes: 0, close_hour: 18, close_minutes: 0 },
  { day_of_week: 5, name: 'Friday',    closed_all_day: false, open_hour: 9, open_minutes: 0, close_hour: 17, close_minutes: 0 },
  { day_of_week: 6, name: 'Saturday',  closed_all_day: true,  open_hour: 9, open_minutes: 0, close_hour: 13, close_minutes: 0 },
];
```

---

## STEP 3 — Full rewrite: `src/components/settings/WebhooksSection.tsx`

This section is **currently useState-only** — no real API. Replace it entirely.

Chatwoot v4 webhook subscriptions use these exact string keys:
`conversation_created` | `conversation_status_changed` | `conversation_updated` |
`message_created` | `conversation_resolved` | `webwidget_triggered`

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  listWebhooks, createWebhook, deleteWebhook,
  type CWWebhook,
} from '@/lib/api/settings';
import { DEMO_WEBHOOKS } from '@/lib/demo/settingsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { SectionHeader } from './shared/SectionHeader';
import { ConfirmDialog } from './shared/ConfirmDialog';
import { EmptyState } from './shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Globe, Trash2, Copy, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// Chatwoot v4 subscription event keys
const SUBSCRIPTION_EVENTS = [
  { key: 'conversation_created',          label: 'Conversation created'           },
  { key: 'conversation_status_changed',   label: 'Conversation status changed'    },
  { key: 'conversation_updated',          label: 'Conversation updated'           },
  { key: 'message_created',              label: 'Message created'                },
  { key: 'conversation_resolved',        label: 'Conversation resolved'          },
  { key: 'webwidget_triggered',          label: 'Web widget triggered'           },
] as const;

const schema = z.object({
  url: z.string().url('Enter a valid URL starting with https://'),
});
type WebhookForm = z.infer<typeof schema>;

export function WebhooksSection() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<CWWebhook | null>(null);

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_WEBHOOKS;
      try {
        const list = await listWebhooks();
        return list.length ? list : DEMO_WEBHOOKS;
      } catch {
        return DEMO_WEBHOOKS;
      }
    },
    staleTime: 30_000,
  });

  const { mutate: addWebhook, isPending: adding } = useMutation({
    mutationFn: async ({ url }: { url: string }) => {
      if (isDemoDataEnabled()) {
        await new Promise(r => setTimeout(r, 500));
        return { id: Date.now(), url, subscriptions: selectedSubs };
      }
      return createWebhook({ url, subscriptions: selectedSubs });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook added');
      setAddOpen(false);
      reset();
      setSelectedSubs([]);
    },
    onError: (e: Error) => toast.error(`Failed to add webhook: ${e.message}`),
  });

  const { mutate: removeWebhook, isPending: deleting } = useMutation({
    mutationFn: async () => {
      if (isDemoDataEnabled()) {
        await new Promise(r => setTimeout(r, 400));
        return;
      }
      await deleteWebhook(deleteTarget!.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook removed');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(`Failed to remove webhook: ${e.message}`),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<WebhookForm>({
    resolver: zodResolver(schema),
  });

  function toggleSub(key: string) {
    setSelectedSubs(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key],
    );
  }

  function copyUrl(url: string) {
    void navigator.clipboard.writeText(url);
    toast.success('URL copied');
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Webhooks"
        description="Receive real-time POST notifications to any HTTPS endpoint."
        actionLabel="Add webhook"
        onAction={() => setAddOpen(true)}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : webhooks.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No webhooks yet"
          description="Connect external services to receive real-time event notifications."
          actionLabel="Add webhook"
          onAction={() => setAddOpen(true)}
        />
      ) : (
        <div className="space-y-2">
          {webhooks.map(hook => (
            <div
              key={hook.id}
              className="border rounded-lg px-4 py-3 bg-white flex items-start gap-3"
            >
              <Globe size={15} className="text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-medium truncate">{hook.url}</p>
                  <button
                    type="button"
                    onClick={() => copyUrl(hook.url)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Copy webhook URL"
                  >
                    <Copy size={12} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {hook.subscriptions.map(s => (
                    <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0">
                      {s.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(hook)}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
                aria-label="Delete webhook"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add webhook sheet */}
      <Sheet open={addOpen} onOpenChange={o => !o && setAddOpen(false)}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add webhook</SheetTitle>
          </SheetHeader>
          <form
            onSubmit={handleSubmit(d => addWebhook(d))}
            className="space-y-5 mt-6"
          >
            <div className="space-y-1.5">
              <Label htmlFor="webhook-url" className="text-xs">Endpoint URL *</Label>
              <Input
                id="webhook-url"
                {...register('url')}
                placeholder="https://your-server.com/webhook"
              />
              {errors.url && (
                <p className="text-xs text-destructive">{errors.url.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Subscribe to events</Label>
              <div className="border rounded-lg divide-y">
                {SUBSCRIPTION_EVENTS.map(({ key, label }) => {
                  const checked = selectedSubs.includes(key);
                  return (
                    <label
                      key={key}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors',
                      )}
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                          checked
                            ? 'bg-brand-primary border-brand-primary'
                            : 'border-gray-300',
                        )}
                        onClick={() => toggleSub(key)}
                      >
                        {checked && <CheckCircle2 size={10} className="text-white" />}
                      </div>
                      <span className="text-sm">{label}</span>
                      <code className="text-[10px] text-muted-foreground ms-auto">{key}</code>
                    </label>
                  );
                })}
              </div>
              {selectedSubs.length === 0 && (
                <p className="text-xs text-amber-600">Select at least one event to subscribe to.</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                className="bg-brand-primary hover:bg-brand-primary/90 flex-1"
                disabled={adding || selectedSubs.length === 0}
              >
                {adding ? 'Adding…' : 'Add webhook'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setAddOpen(false); reset(); setSelectedSubs([]); }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete webhook?"
        description={`This will permanently remove the endpoint "${deleteTarget?.url}". Events will no longer be sent there.`}
        confirmLabel="Delete"
        isPending={deleting}
        onConfirm={() => removeWebhook()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
```

---

## STEP 4 — Full rewrite: `src/components/settings/ProfileSection.tsx`

Currently uses `await new Promise(...)` mock. Replace with real Chatwoot `/api/v1/profile` API.

```tsx
'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { getProfile, updateProfile } from '@/lib/api/settings';
import { DEMO_PROFILE } from '@/lib/demo/settingsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { useAuthStore } from '@/lib/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ROLE_META } from '@/lib/rbac';

const profileSchema = z.object({
  name:          z.string().min(2, 'Name must be at least 2 characters'),
  email:         z.string().email('Enter a valid email'),
  display_name:  z.string().optional(),
  phone_number:  z.string().optional(),
});

const passwordSchema = z.object({
  current_password:      z.string().min(1, 'Enter your current password'),
  password:              z.string().min(6, 'Password must be at least 6 characters'),
  password_confirmation: z.string(),
}).refine(d => d.password === d.password_confirmation, {
  message: 'Passwords do not match',
  path: ['password_confirmation'],
});

type ProfileForm   = z.infer<typeof profileSchema>;
type PasswordForm  = z.infer<typeof passwordSchema>;

export function ProfileSection() {
  const qc   = useQueryClient();
  const user = useAuthStore(s => s.user);
  const roleMeta = ROLE_META[(user?.role ?? 'agent') as keyof typeof ROLE_META];

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_PROFILE;
      try { return await getProfile(); }
      catch { return DEMO_PROFILE; }
    },
  });

  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: async (data: ProfileForm) => {
      if (isDemoDataEnabled()) {
        await new Promise(r => setTimeout(r, 500));
        return { ...DEMO_PROFILE, ...data };
      }
      return updateProfile(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { mutate: savePassword, isPending: savingPassword } = useMutation({
    mutationFn: async (data: PasswordForm) => {
      if (isDemoDataEnabled()) {
        await new Promise(r => setTimeout(r, 500));
        return;
      }
      await updateProfile(data);
    },
    onSuccess: () => {
      toast.success('Password updated');
      passwordForm.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', email: '', display_name: '', phone_number: '' },
  });

  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    if (!profile) return;
    profileForm.reset({
      name:         profile.name,
      email:        profile.email,
      display_name: profile.display_name ?? '',
      phone_number: profile.phone_number ?? '',
    });
  }, [profile, profileForm]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-9" />)}
      </div>
    );
  }

  const initials = (profile?.name ?? user?.name ?? '??').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your personal account details visible to teammates.
        </p>
      </div>

      {/* Avatar + role */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-semibold shrink-0">
          {initials}
        </div>
        <div>
          <p className="text-sm font-medium">{profile?.name ?? user?.name}</p>
          <p className="text-xs text-muted-foreground">{profile?.email ?? user?.email}</p>
          {roleMeta && (
            <Badge className={`mt-1 text-[10px] ${roleMeta.color}`}>
              {roleMeta.label}
            </Badge>
          )}
        </div>
      </div>

      {/* Profile form */}
      <form onSubmit={profileForm.handleSubmit(d => saveProfile(d))} className="space-y-4 max-w-md">
        <div className="border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold">Personal details</h2>

          {(
            [
              { id: 'name',         label: 'Full name',    placeholder: 'Ahmed Al-Rashidi' },
              { id: 'display_name', label: 'Display name', placeholder: 'Ahmed' },
              { id: 'email',        label: 'Email',        placeholder: 'ahmed@company.com', type: 'email' },
              { id: 'phone_number', label: 'Phone number', placeholder: '+96891234567',      type: 'tel'   },
            ] as const
          ).map(({ id, label, placeholder, type }) => (
            <div key={id} className="space-y-1">
              <Label htmlFor={id} className="text-xs">{label}</Label>
              <Input
                id={id}
                type={type ?? 'text'}
                placeholder={placeholder}
                {...profileForm.register(id)}
              />
              {profileForm.formState.errors[id] && (
                <p className="text-xs text-destructive">
                  {profileForm.formState.errors[id]?.message}
                </p>
              )}
            </div>
          ))}

          <Button
            type="submit"
            disabled={savingProfile || !profileForm.formState.isDirty}
            className="bg-brand-primary hover:bg-brand-primary/90 w-full sm:w-auto"
          >
            {savingProfile ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </form>

      {/* Password form */}
      <form onSubmit={passwordForm.handleSubmit(d => savePassword(d))} className="space-y-4 max-w-md">
        <div className="border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold">Change password</h2>

          {(
            [
              { id: 'current_password',      label: 'Current password'      },
              { id: 'password',              label: 'New password'           },
              { id: 'password_confirmation', label: 'Confirm new password'   },
            ] as const
          ).map(({ id, label }) => (
            <div key={id} className="space-y-1">
              <Label htmlFor={id} className="text-xs">{label}</Label>
              <Input id={id} type="password" {...passwordForm.register(id)} />
              {passwordForm.formState.errors[id] && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors[id]?.message}
                </p>
              )}
            </div>
          ))}

          <Button
            type="submit"
            disabled={savingPassword}
            variant="outline"
            className="w-full sm:w-auto"
          >
            {savingPassword ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

---

## STEP 5 — Full rewrite: `src/components/settings/NotificationsSection.tsx`

Currently `useState`-only mock. Replace with real Chatwoot `/api/v1/profile/notifications`.

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/api/settings';
import { DEMO_NOTIFICATION_PREFS } from '@/lib/demo/settingsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Bell } from 'lucide-react';

const NOTIFICATION_TYPES = [
  { key: 'conversation_creation',    label: 'New conversation',     description: 'When a new conversation is created'          },
  { key: 'conversation_assignment',  label: 'Conversation assigned', description: 'When a conversation is assigned to you'     },
  { key: 'conversation_mention',     label: 'Mentioned',             description: 'When someone mentions you in a note'        },
  { key: 'assigned_conversation_creation', label: 'New message',    description: 'When your assigned conversation gets a new message' },
  { key: 'participant_conversation_creation', label: 'Participant message', description: 'New message in a conversation you participate in' },
] as const;

type NotifKey = (typeof NOTIFICATION_TYPES)[number]['key'];

interface PrefsState {
  email: Record<string, boolean>;
  push:  Record<string, boolean>;
}

export function NotificationsSection() {
  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_NOTIFICATION_PREFS;
      try { return await getNotificationPreferences(); }
      catch { return DEMO_NOTIFICATION_PREFS; }
    },
  });

  const [state, setState] = useState<PrefsState>({ email: {}, push: {} });

  useEffect(() => {
    if (!prefs) return;
    const email: Record<string, boolean> = {};
    const push:  Record<string, boolean> = {};
    NOTIFICATION_TYPES.forEach(({ key }) => {
      email[key] = prefs.selected_email_flags.includes(key);
      push[key]  = prefs.selected_push_flags.includes(key);
    });
    setState({ email, push });
  }, [prefs]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      if (isDemoDataEnabled()) {
        await new Promise(r => setTimeout(r, 500));
        return;
      }
      await updateNotificationPreferences({
        notifications: NOTIFICATION_TYPES.map(({ key }) => ({
          notification_type: key,
          email: state.email[key] ?? false,
          push:  state.push[key]  ?? false,
        })),
      });
    },
    onSuccess: () => toast.success('Notification preferences saved'),
    onError:   (e: Error) => toast.error(e.message),
  });

  function toggle(channel: 'email' | 'push', key: string) {
    setState(prev => ({
      ...prev,
      [channel]: { ...prev[channel], [key]: !prev[channel][key] },
    }));
  }

  if (isLoading) {
    return <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose how you receive notifications for different events.
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Event</th>
              <th className="px-4 py-2.5 text-center w-24">
                <div className="flex items-center justify-center gap-1">
                  <Mail size={13} /> Email
                </div>
              </th>
              <th className="px-4 py-2.5 text-center w-24">
                <div className="flex items-center justify-center gap-1">
                  <Bell size={13} /> Push
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_TYPES.map(({ key, label, description }) => (
              <tr key={key} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <Switch
                    checked={state.email[key] ?? false}
                    onCheckedChange={() => toggle('email', key)}
                    aria-label={`Email for ${label}`}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <Switch
                    checked={state.push[key] ?? false}
                    onCheckedChange={() => toggle('push', key)}
                    aria-label={`Push for ${label}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button
          disabled={isPending}
          onClick={() => save()}
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {isPending ? 'Saving…' : 'Save preferences'}
        </Button>
      </div>
    </div>
  );
}
```

---

## STEP 6 — Full rewrite: `src/components/settings/BusinessHoursSection.tsx`

Currently `useState`-only mock with local data. Replace with real Chatwoot account business hours API.

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getBusinessHours, updateBusinessHours, type BusinessHourEntry } from '@/lib/api/settings';
import { DEMO_BUSINESS_HOURS } from '@/lib/demo/settingsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Generate HH:MM options every 30 min
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

function fmt(h: number, m: number) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parse(v: string): { h: number; m: number } {
  const [hh, mm] = v.split(':').map(Number);
  return { h: hh ?? 0, m: mm ?? 0 };
}

export function BusinessHoursSection() {
  const qc = useQueryClient();
  const [hours, setHours] = useState<BusinessHourEntry[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['business-hours'],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_BUSINESS_HOURS;
      try {
        const list = await getBusinessHours();
        return list.length ? list : DEMO_BUSINESS_HOURS;
      } catch {
        return DEMO_BUSINESS_HOURS;
      }
    },
  });

  useEffect(() => {
    if (data?.length) {
      // Sort Sun–Sat (0–6)
      setHours([...data].sort((a, b) => a.day_of_week - b.day_of_week));
    }
  }, [data]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      if (isDemoDataEnabled()) {
        await new Promise(r => setTimeout(r, 500));
        return;
      }
      await updateBusinessHours(hours);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-hours'] });
      toast.success('Business hours saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function patch(dayOfWeek: number, changes: Partial<BusinessHourEntry>) {
    setHours(prev =>
      prev.map(h => h.day_of_week === dayOfWeek ? { ...h, ...changes } : h),
    );
  }

  if (isLoading) {
    return <div className="space-y-2">{[1,2,3,4,5,6,7].map(i => <Skeleton key={i} className="h-10 rounded" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Business Hours</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define your account-wide operating hours. Inboxes can override these per-inbox.
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {hours.map((day, idx) => (
          <div
            key={day.day_of_week}
            className={cn(
              'flex items-center gap-4 px-4 py-3',
              idx < hours.length - 1 && 'border-b',
              day.closed_all_day && 'opacity-60',
            )}
          >
            {/* Day toggle */}
            <Switch
              checked={!day.closed_all_day}
              onCheckedChange={open => patch(day.day_of_week, { closed_all_day: !open })}
              aria-label={DAY_NAMES[day.day_of_week]}
            />

            {/* Day name */}
            <span className="w-28 text-sm shrink-0">
              {DAY_NAMES[day.day_of_week] ?? day.name}
            </span>

            {/* Time pickers — hidden when closed */}
            {!day.closed_all_day ? (
              <div className="flex items-center gap-2 flex-1">
                <select
                  className="border rounded px-2 py-1.5 text-sm bg-background w-24"
                  value={fmt(day.open_hour, day.open_minutes)}
                  onChange={e => {
                    const { h, m } = parse(e.target.value);
                    patch(day.day_of_week, { open_hour: h, open_minutes: m });
                  }}
                  aria-label={`${DAY_NAMES[day.day_of_week]} open time`}
                >
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className="text-muted-foreground text-sm">–</span>
                <select
                  className="border rounded px-2 py-1.5 text-sm bg-background w-24"
                  value={fmt(day.close_hour, day.close_minutes)}
                  onChange={e => {
                    const { h, m } = parse(e.target.value);
                    patch(day.day_of_week, { close_hour: h, close_minutes: m });
                  }}
                  aria-label={`${DAY_NAMES[day.day_of_week]} close time`}
                >
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground flex-1">Closed all day</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          disabled={isPending}
          onClick={() => save()}
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {isPending ? 'Saving…' : 'Save hours'}
        </Button>
      </div>
    </div>
  );
}
```

---

## STEP 7 — Fix `src/components/settings/IntegrationsSection.tsx`

The current `Sheet` import uses a non-standard path (`@/components/ui/Sheet` with capital S). Fix the import and wire the "connected" state to `listIntegrationApps` so it reflects real Chatwoot integration status.

Replace the import lines and the connected state logic:

```tsx
// REPLACE the existing Sheet import:
// OLD: import { Sheet } from '@/components/ui/Sheet';
// NEW:
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';

// REPLACE the existing connected useState + integration logic — add this block:
import { useQuery } from '@tanstack/react-query';
import { listIntegrationApps } from '@/lib/api/settings';
import { isDemoDataEnabled } from '@/lib/demo/config';
```

Then replace the component's `connected` state and `toggleConnect` with real API data:

```tsx
// Replace useState for connected with:
const { data: appData } = useQuery({
  queryKey: ['integration-apps'],
  queryFn: async () => {
    if (isDemoDataEnabled()) {
      return { payload: [
        { id: 'slack', name: 'Slack', enabled: true  },
        { id: 'openai', name: 'OpenAI', enabled: true },
      ]};
    }
    try { return await listIntegrationApps(); }
    catch { return { payload: [] }; }
  },
});

// Derive connected set from real data (falls back to empty)
const connected = new Set(
  (appData?.payload ?? []).filter(a => a.enabled).map(a => a.id),
);
```

Also fix the Sheet usage — replace the custom `<Sheet open onClose title>` pattern with shadcn standard:

```tsx
// Replace <Sheet open={!!configureApp} onClose={...} title={...}> with:
<Sheet open={!!configureApp} onOpenChange={o => !o && setConfigureApp(null)}>
  <SheetContent side="right" className="sm:max-w-md">
    <SheetHeader>
      <SheetTitle>{configureApp ? `Configure ${configureApp.name}` : 'Configure'}</SheetTitle>
      <SheetDescription>
        Connect {configureApp?.name} to receive BlinkOne events.
      </SheetDescription>
    </SheetHeader>
    {/* existing content stays unchanged */}
  </SheetContent>
</Sheet>
```

Remove the standalone `setConnected` calls — connection state is now read from the API. The "Mark as connected" / "Disconnect" button becomes informational only (copy URL + instructions).

---

## STEP 8 — Error boundary pattern for all sections

Every settings section `queryFn` must follow this exact try/catch shape. Go through each section and ensure they match:

```ts
queryFn: async () => {
  if (isDemoDataEnabled()) return DEMO_XXX;
  try {
    const data = await realApiCall();
    // Prefer real data; fall back to demo if API returns empty
    return data ?? DEMO_XXX;
  } catch {
    // Network/auth errors fall back silently to demo data
    return DEMO_XXX;
  }
},
```

Every mutation must follow:

```ts
mutationFn: async (payload) => {
  if (isDemoDataEnabled()) {
    await settingsDemoDelay();   // realistic 400-600ms delay
    return /* mock return value */;
  }
  return realApiMutation(payload);
},
onSuccess: () => { qc.invalidateQueries({ queryKey: ['key'] }); toast.success('…'); },
onError:   (e: Error) => toast.error(e.message),
```

Sections to audit and fix if needed: `AccountSection`, `AgentsSection`, `TeamsSection`, `LabelsSection`, `CustomAttrsSection`, `AutomationSection`, `BotsSection`, `MacrosSection`, `CannedSection`.

---

## STEP 9 — Checklist before finishing

Go through every item:

**API layer (`src/lib/api/settings.ts`)**
- [ ] `listWebhooks` / `createWebhook` / `updateWebhook` / `deleteWebhook` added — use `{ webhook: data }` wrapper in POST/PATCH body (Chatwoot v4 requirement)
- [ ] `getProfile` / `updateProfile` / `updateAvailability` added — path is `/profile` (no account prefix)
- [ ] `getNotificationPreferences` / `updateNotificationPreferences` added — path is `/profile/notifications`
- [ ] `getBusinessHours` / `updateBusinessHours` added — path is `/accounts/:id/business_hours`
- [ ] `listIntegrationApps` added — path is `/accounts/:id/integrations/apps`
- [ ] All new functions use `cwFetch` only — zero raw `fetch`

**Demo fixtures (`src/lib/demo/settingsFixture.ts`)**
- [ ] `DEMO_WEBHOOKS` — 2 entries with realistic Omani URLs
- [ ] `DEMO_PROFILE` — matches LABBIK Telecom agent data
- [ ] `DEMO_NOTIFICATION_PREFS` — `selected_email_flags` + `selected_push_flags`
- [ ] `DEMO_BUSINESS_HOURS` — 7 entries Sun–Sat, Gulf region defaults (Fri open, Sat closed)

**WebhooksSection**
- [ ] Full rewrite — no more `useState` array management
- [ ] `useQuery(['webhooks'])` → `listWebhooks()`
- [ ] Create via `createWebhook` mutation with `{ url, subscriptions }` body
- [ ] Delete via `deleteWebhook(id)` with `ConfirmDialog`
- [ ] All 6 Chatwoot subscription event keys listed with human labels
- [ ] Validation: URL required + valid HTTPS, at least 1 subscription selected

**ProfileSection**
- [ ] `useQuery(['profile'])` → `getProfile()`
- [ ] Profile form: name, display_name, email, phone_number — PATCH via `updateProfile`
- [ ] Password form: current_password, password, password_confirmation — validated with zod `.refine`
- [ ] Avatar initials from live profile data
- [ ] Role badge from `ROLE_META`

**NotificationsSection**
- [ ] `useQuery(['notification-prefs'])` → `getNotificationPreferences()`
- [ ] Table: Event | Email toggle | Push toggle
- [ ] All 5 Chatwoot notification type keys listed
- [ ] Single "Save preferences" button calls `updateNotificationPreferences`

**BusinessHoursSection**
- [ ] `useQuery(['business-hours'])` → `getBusinessHours()`
- [ ] Sorted Sun(0)–Sat(6) by `day_of_week`
- [ ] Per-row: Switch (open/closed) + open time select + close time select
- [ ] Closed rows show "Closed all day" text and are visually dimmed
- [ ] Save calls `updateBusinessHours(hours)` with full array

**IntegrationsSection**
- [ ] `Sheet` import fixed to `@/components/ui/sheet` (lowercase)
- [ ] `SheetContent` / `SheetHeader` / `SheetTitle` used instead of custom props
- [ ] `connected` derived from `listIntegrationApps()` query — not `useState`
- [ ] No raw `setConnected` calls remain

**All sections**
- [ ] Every `queryFn`: `isDemoDataEnabled()` guard at top, try/catch fallback to demo
- [ ] Every `mutationFn`: `isDemoDataEnabled()` guard with `settingsDemoDelay()` + mock return
- [ ] Every `onSuccess`: `qc.invalidateQueries` + `toast.success`
- [ ] Every `onError`: `toast.error(e.message)`
- [ ] Zero raw `fetch` calls anywhere in settings components
- [ ] Zero `useState` for server data (all via TanStack Query)
- [ ] RTL-safe spacing throughout

---

## Acceptance criteria

1. **Webhooks**: Page loads real webhooks from Chatwoot. Adding a webhook with URL + selected events POSTs to `/api/v1/accounts/:id/integrations/webhooks` with `{ webhook: { url, subscriptions } }`. Delete fires DELETE with confirmation. Demo mode shows 2 fixture webhooks.

2. **Profile**: Page loads real profile from `/api/v1/profile`. Saving profile PUTs to `/api/v1/profile`. Password change works with current/new/confirm validation. Demo shows DEMO_PROFILE data.

3. **Notifications**: Page loads real prefs from `/api/v1/profile/notifications`. Table shows 5 event types × 2 channels. Save PUTs to `/api/v1/profile/notifications`. Demo shows 3 email + 2 push flags enabled.

4. **Business Hours**: Page loads real hours from `/api/v1/accounts/:id/business_hours`. Each day toggleable open/closed. Time dropdowns in 30-min increments. Save PUTs full array. Demo shows Gulf defaults (Fri open, Sat closed).

5. **Integrations**: `listIntegrationApps()` determines which apps show "Connected". Sheet uses standard shadcn `SheetContent`. No broken Sheet import.

6. **All sections**: Turning off demo mode (`NEXT_PUBLIC_USE_DEMO_DATA=false`) and pointing at a real Chatwoot instance makes every section fetch and mutate against the real API. No TypeScript errors. No console errors about missing props.
