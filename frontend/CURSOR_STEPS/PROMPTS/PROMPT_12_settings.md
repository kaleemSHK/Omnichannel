# CURSOR PROMPT — STEP 12: Settings + SLA Business Hours
> Paste this ENTIRE file into Cursor Composer.
> This step fills the TWO remaining gaps: (1) the Settings page is a pure placeholder, (2) the SLA "Business hours" sub-section is a SectionPlaceholder.
> Verify every checkbox at the bottom before marking complete.

---

Read `.cursorrules` before writing a single line.

---

## FILES TO CREATE

```
src/app/(dashboard)/settings/page.tsx          ← replace the placeholder
src/components/settings/SettingsNav.tsx
src/components/settings/ProfileSection.tsx
src/components/settings/NotificationsSection.tsx
src/components/settings/TeamSection.tsx
src/components/settings/InboxSection.tsx
src/components/settings/WebhooksSection.tsx
src/components/settings/BusinessHoursSection.tsx
```

## FILE TO PATCH

```
src/components/sla/SLAWorkspace.tsx            ← replace the SectionPlaceholder for 'hours' view
```

---

## LAYOUT

```
[52px IconSidebar] | [200px SettingsNav] | [flex-1 settings-content]
```

---

## `src/app/(dashboard)/settings/page.tsx`

```tsx
'use client'
import { useState } from 'react'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { ProfileSection } from '@/components/settings/ProfileSection'
import { NotificationsSection } from '@/components/settings/NotificationsSection'
import { TeamSection } from '@/components/settings/TeamSection'
import { InboxSection } from '@/components/settings/InboxSection'
import { WebhooksSection } from '@/components/settings/WebhooksSection'
import { BusinessHoursSection } from '@/components/settings/BusinessHoursSection'

type SettingsView = 'profile' | 'notifications' | 'team' | 'inboxes' | 'webhooks' | 'business-hours'

export default function SettingsPage() {
  const [view, setView] = useState<SettingsView>('profile')

  const content: Record<SettingsView, React.ReactNode> = {
    profile:        <ProfileSection />,
    notifications:  <NotificationsSection />,
    team:           <TeamSection />,
    inboxes:        <InboxSection />,
    webhooks:       <WebhooksSection />,
    'business-hours': <BusinessHoursSection />,
  }

  return (
    <div className="flex h-full overflow-hidden">
      <SettingsNav active={view} onChange={setView} />
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
        {content[view]}
      </div>
    </div>
  )
}
```

---

## `src/components/settings/SettingsNav.tsx`

```tsx
'use client'
import { cn } from '@/lib/utils/cn'
import {
  User, Bell, Users, Inbox, Webhook, Clock,
} from 'lucide-react'

const NAV_ITEMS = [
  { id: 'profile',        label: 'Profile',         icon: User,    group: 'Account' },
  { id: 'notifications',  label: 'Notifications',   icon: Bell,    group: 'Account' },
  { id: 'team',           label: 'Team & Agents',   icon: Users,   group: 'Workspace' },
  { id: 'inboxes',        label: 'Inboxes',         icon: Inbox,   group: 'Workspace' },
  { id: 'webhooks',       label: 'Webhooks',        icon: Webhook, group: 'Workspace' },
  { id: 'business-hours', label: 'Business hours',  icon: Clock,   group: 'Workspace' },
] as const

type SettingsView = typeof NAV_ITEMS[number]['id']

interface Props {
  active: SettingsView
  onChange: (v: SettingsView) => void
}

export function SettingsNav({ active, onChange }: Props) {
  const groups = [...new Set(NAV_ITEMS.map(i => i.group))]

  return (
    <aside className="w-[200px] border-e h-full flex flex-col py-4 px-2 gap-1 shrink-0 bg-muted/20">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
        Settings
      </h2>
      {groups.map(group => (
        <div key={group} className="mb-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
            {group}
          </p>
          {NAV_ITEMS.filter(i => i.group === group).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-start',
                active === id
                  ? 'bg-blue-50 text-brand-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      ))}
    </aside>
  )
}
```

---

## `src/components/settings/ProfileSection.tsx`

'use client'. Uses react-hook-form + zod.

Data: read from `useAuthStore().user` — no API call needed for display.
Save: call `updateProfile(data)` from `src/lib/api/auth.ts` if it exists, otherwise stub with `toast.success('Profile saved')`.

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '@/lib/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

const schema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters'),
  email:    z.string().email('Enter a valid email'),
  phone:    z.string().optional(),
})
type ProfileForm = z.infer<typeof schema>

export function ProfileSection() {
  const user = useAuthStore(s => s.user)

  const { register, handleSubmit, formState: { errors, isDirty, isSubmitting } } = useForm<ProfileForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '', phone: '' },
  })

  async function onSubmit(data: ProfileForm) {
    // TODO: wire to updateProfile(data) when endpoint is ready
    await new Promise(r => setTimeout(r, 500)) // simulate
    toast.success('Profile updated')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your personal account details visible to teammates.
        </p>
      </div>

      {/* Avatar row */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-semibold">
          {user?.name?.slice(0, 2).toUpperCase() ?? '??'}
        </div>
        <div>
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" type="tel" placeholder="+968 9XXX XXXX" {...register('phone')} />
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={!isDirty || isSubmitting}
            className="bg-brand-primary hover:bg-brand-primary/90"
          >
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>

      {/* Change password section */}
      <div className="border-t pt-6 space-y-4 max-w-md">
        <h2 className="text-sm font-semibold">Change password</h2>
        <div className="space-y-1.5">
          <Label>Current password</Label>
          <Input type="password" placeholder="••••••••" />
        </div>
        <div className="space-y-1.5">
          <Label>New password</Label>
          <Input type="password" placeholder="min. 8 characters" />
        </div>
        <Button variant="outline" onClick={() => toast.success('Password updated')}>
          Update password
        </Button>
      </div>
    </div>
  )
}
```

---

## `src/components/settings/NotificationsSection.tsx`

'use client'. All state is local (no API — these would sync to a user_prefs endpoint later).

```tsx
'use client'
import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const NOTIFICATION_PREFS = [
  { id: 'new_conversation',  label: 'New conversation assigned to me',      group: 'In-app' },
  { id: 'mention',           label: 'Someone mentions me in a note',        group: 'In-app' },
  { id: 'sla_breach',        label: 'SLA breach alert',                     group: 'In-app' },
  { id: 'incoming_call',     label: 'Incoming call notification',           group: 'In-app' },
  { id: 'email_new_conv',    label: 'New conversation (email digest)',       group: 'Email' },
  { id: 'email_sla',         label: 'SLA breached (email alert)',           group: 'Email' },
  { id: 'email_ticket',      label: 'Ticket assigned to me (email)',        group: 'Email' },
  { id: 'sms_call_missed',   label: 'Missed call alert (SMS)',              group: 'SMS' },
]

export function NotificationsSection() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    new_conversation: true,
    mention: true,
    sla_breach: true,
    incoming_call: true,
    email_new_conv: false,
    email_sla: true,
    email_ticket: false,
    sms_call_missed: false,
  })

  const groups = [...new Set(NOTIFICATION_PREFS.map(p => p.group))]

  function toggle(id: string) {
    setPrefs(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control which events trigger alerts for your account.
        </p>
      </div>

      {groups.map(group => (
        <div key={group} className="space-y-3">
          <h2 className="text-sm font-semibold border-b pb-1">{group}</h2>
          {NOTIFICATION_PREFS.filter(p => p.group === group).map(({ id, label }) => (
            <div key={id} className="flex items-center justify-between py-1">
              <Label htmlFor={id} className="text-sm cursor-pointer">{label}</Label>
              <Switch id={id} checked={prefs[id] ?? false} onCheckedChange={() => toggle(id)} />
            </div>
          ))}
        </div>
      ))}

      <Button
        onClick={() => toast.success('Notification preferences saved')}
        className="bg-brand-primary hover:bg-brand-primary/90"
      >
        Save preferences
      </Button>
    </div>
  )
}
```

---

## `src/components/settings/TeamSection.tsx`

'use client'. Shows agents list + invite form.

```tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listAgents } from '@/lib/api/routing'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserPlus, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'

const STATE_COLORS: Record<string, string> = {
  online:  'bg-green-500',
  busy:    'bg-amber-500',
  offline: 'bg-gray-400',
}

export function TeamSection() {
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: listAgents,
  })

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('agent')
  const [inviting, setInviting] = useState(false)

  async function handleInvite() {
    if (!inviteEmail) return
    setInviting(true)
    await new Promise(r => setTimeout(r, 600))
    setInviting(false)
    setInviteEmail('')
    toast.success(`Invite sent to ${inviteEmail}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Team & Agents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your agents and their roles.
        </p>
      </div>

      {/* Invite form */}
      <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <UserPlus size={15} /> Invite agent
        </h2>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Email address</Label>
            <Input
              type="email"
              placeholder="agent@labbik.om"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
          </div>
          <div className="w-36 space-y-1">
            <Label className="text-xs">Role</Label>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleInvite}
              disabled={!inviteEmail || inviting}
              className="bg-brand-primary hover:bg-brand-primary/90"
            >
              <Mail size={14} className="me-1.5" />
              {inviting ? 'Sending…' : 'Invite'}
            </Button>
          </div>
        </div>
      </div>

      {/* Agents table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Agent</th>
              <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Role</th>
              <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [1, 2, 3].map(i => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3" />
                  </tr>
                ))
              : agents.map(agent => (
                  <tr key={agent.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center justify-center shrink-0">
                          {agent.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{agent.role}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className={cn('w-2 h-2 rounded-full', STATE_COLORS[agent.availability_status] ?? 'bg-gray-400')} />
                        <span className="text-xs capitalize">{agent.availability_status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <button className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

---

## `src/components/settings/InboxSection.tsx`

'use client'. Lists inboxes from Chatwoot.

```tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { listInboxes } from '@/lib/api/conversations'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageSquare, Phone, Mail, Globe, Pencil } from 'lucide-react'

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  Channel::TwilioSms:     Phone,
  Channel::Whatsapp:      MessageSquare,
  Channel::Email:         Mail,
  Channel::WebWidget:     Globe,
  default:                MessageSquare,
}

const CHANNEL_LABELS: Record<string, string> = {
  'Channel::TwilioSms':   'SMS',
  'Channel::Whatsapp':    'WhatsApp',
  'Channel::Email':       'Email',
  'Channel::WebWidget':   'Web Widget',
}

export function InboxSection() {
  const { data: inboxes = [], isLoading } = useQuery({
    queryKey: ['inboxes'],
    queryFn: listInboxes,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Inboxes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connected channels for your account.
          </p>
        </div>
        <Button className="bg-brand-primary hover:bg-brand-primary/90 text-sm" size="sm">
          + New inbox
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading
          ? [1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)
          : inboxes.map(inbox => {
              const Icon = CHANNEL_ICONS[inbox.channel_type] ?? CHANNEL_ICONS.default
              const label = CHANNEL_LABELS[inbox.channel_type] ?? inbox.channel_type
              return (
                <div key={inbox.id}
                  className="flex items-center gap-3 border rounded-lg px-4 py-3 bg-white hover:bg-muted/20 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-brand-primary flex items-center justify-center shrink-0">
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{inbox.name}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {inbox.working_hours_enabled ? 'Business hours on' : 'Always on'}
                  </Badge>
                  <Button variant="ghost" size="icon" className="shrink-0 w-8 h-8">
                    <Pencil size={13} />
                  </Button>
                </div>
              )
            })
        }
      </div>
    </div>
  )
}
```

Note: if `listInboxes` does not exist in `src/lib/api/conversations.ts`, add this stub to the component file (do NOT modify conversations.ts):
```ts
// temporary stub if listInboxes is missing from API layer
async function listInboxes() { return [] as CWInbox[] }
```

---

## `src/components/settings/WebhooksSection.tsx`

'use client'. Simple webhook list + add form.

```tsx
'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Globe, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'

const schema = z.object({
  url: z.string().url('Enter a valid HTTPS URL'),
})
type WebhookForm = z.infer<typeof schema>

const EVENT_TYPES = [
  'conversation.created',
  'conversation.resolved',
  'message.created',
  'call.ended',
  'sla.breached',
  'ticket.created',
]

interface Webhook {
  id: string
  url: string
  events: string[]
  active: boolean
}

export function WebhooksSection() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([
    { id: '1', url: 'https://n8n.labbik.om/webhook/blinkone', events: ['message.created', 'call.ended'], active: true },
  ])
  const [showForm, setShowForm] = useState(false)
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<WebhookForm>({
    resolver: zodResolver(schema),
  })

  function onSubmit(data: WebhookForm) {
    const newHook: Webhook = {
      id: Date.now().toString(),
      url: data.url,
      events: selectedEvents,
      active: true,
    }
    setWebhooks(prev => [...prev, newHook])
    reset()
    setSelectedEvents([])
    setShowForm(false)
    toast.success('Webhook added')
  }

  function toggleEvent(event: string) {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  function deleteWebhook(id: string) {
    setWebhooks(prev => prev.filter(w => w.id !== id))
    toast.success('Webhook removed')
  }

  function toggleActive(id: string) {
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, active: !w.active } : w))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Webhooks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            POST event payloads to external URLs (e.g. n8n, Zapier, custom).
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(v => !v)}
          className="bg-brand-primary hover:bg-brand-primary/90 text-sm">
          <Plus size={14} className="me-1.5" />
          Add webhook
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)}
          className="border rounded-lg p-4 space-y-4 bg-muted/20">
          <div className="space-y-1.5">
            <Label>Endpoint URL</Label>
            <Input {...register('url')} placeholder="https://your-server.com/webhook" />
            {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Events to subscribe</Label>
            <div className="grid grid-cols-2 gap-2">
              {EVENT_TYPES.map(event => (
                <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="rounded"
                  />
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{event}</code>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="bg-brand-primary hover:bg-brand-primary/90">
              Save webhook
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {webhooks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Globe size={32} className="mx-auto mb-3 opacity-30" />
            No webhooks configured
          </div>
        )}
        {webhooks.map(hook => (
          <div key={hook.id}
            className="border rounded-lg px-4 py-3 flex items-start gap-3 bg-white">
            <Globe size={16} className="text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium font-mono truncate">{hook.url}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {hook.events.map(e => (
                  <code key={e} className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{e}</code>
                ))}
              </div>
            </div>
            <Switch checked={hook.active} onCheckedChange={() => toggleActive(hook.id)} />
            <button onClick={() => deleteWebhook(hook.id)}
              className="text-muted-foreground hover:text-destructive transition-colors ms-1">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## `src/components/settings/BusinessHoursSection.tsx`

'use client'. Full business hours editor. This replaces the SectionPlaceholder in SLAWorkspace too.

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
type Day = typeof DAYS[number]

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, '0')
  return [`${h}:00`, `${h}:30`]
}).flat()

interface DaySchedule {
  enabled: boolean
  open: string
  close: string
}

const DEFAULT_SCHEDULE: Record<Day, DaySchedule> = {
  Monday:    { enabled: true,  open: '09:00', close: '18:00' },
  Tuesday:   { enabled: true,  open: '09:00', close: '18:00' },
  Wednesday: { enabled: true,  open: '09:00', close: '18:00' },
  Thursday:  { enabled: true,  open: '09:00', close: '18:00' },
  Friday:    { enabled: true,  open: '09:00', close: '17:00' },
  Saturday:  { enabled: false, open: '09:00', close: '13:00' },
  Sunday:    { enabled: false, open: '09:00', close: '13:00' },
}

export function BusinessHoursSection() {
  const [schedule, setSchedule] = useState<Record<Day, DaySchedule>>(DEFAULT_SCHEDULE)
  const [timezone, setTimezone] = useState('Asia/Muscat')
  const [saving, setSaving] = useState(false)

  function updateDay(day: Day, patch: Partial<DaySchedule>) {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  async function handleSave() {
    setSaving(true)
    await new Promise(r => setTimeout(r, 600))
    setSaving(false)
    toast.success('Business hours saved')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Business hours</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define when your team is available. SLA timers respect these windows when "Business hours only" is enabled on a policy.
        </p>
      </div>

      {/* Timezone */}
      <div className="space-y-1.5 max-w-xs">
        <label className="text-sm font-medium">Timezone</label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              'Asia/Muscat',
              'Asia/Dubai',
              'Asia/Riyadh',
              'Asia/Kuwait',
              'UTC',
              'Europe/London',
              'America/New_York',
            ].map(tz => (
              <SelectItem key={tz} value={tz}>{tz}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Day schedule grid */}
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[120px_60px_1fr_16px_1fr] gap-3 bg-muted/40 border-b px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
          <span>Day</span>
          <span>Open</span>
          <span>Opens at</span>
          <span />
          <span>Closes at</span>
        </div>

        {DAYS.map(day => {
          const d = schedule[day]
          return (
            <div key={day}
              className="grid grid-cols-[120px_60px_1fr_16px_1fr] gap-3 items-center px-4 py-3 border-b last:border-0 hover:bg-muted/10 transition-colors">
              <span className="text-sm font-medium">{day}</span>
              <Switch
                checked={d.enabled}
                onCheckedChange={v => updateDay(day, { enabled: v })}
              />
              <Select
                value={d.open}
                onValueChange={v => updateDay(day, { open: v })}
                disabled={!d.enabled}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48 overflow-y-auto">
                  {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground text-center">→</span>
              <Select
                value={d.close}
                onValueChange={v => updateDay(day, { close: v })}
                disabled={!d.enabled}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48 overflow-y-auto">
                  {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="bg-brand-primary hover:bg-brand-primary/90"
      >
        {saving ? 'Saving…' : 'Save business hours'}
      </Button>
    </div>
  )
}
```

---

## PATCH: `src/components/sla/SLAWorkspace.tsx`

Find the `view === 'hours'` section and replace the `<SectionPlaceholder>` with the real component:

```tsx
// ADD this import at the top of SLAWorkspace.tsx:
import { BusinessHoursSection } from '@/components/settings/BusinessHoursSection'

// REPLACE this block:
{view === 'hours' && (
  <SectionPlaceholder
    title="Business hours"
    description="Calendar editor connects to SLA service /v1/calendars — configure in a later step."
  />
)}

// WITH:
{view === 'hours' && (
  <BusinessHoursSection />
)}
```

Also remove the now-unused `SectionPlaceholder` import from SLAWorkspace.tsx if it's no longer used elsewhere in that file.

---

## CHECKLIST — verify every item:
- [ ] `/settings` renders the full settings page (not "Settings / This screen is on the roadmap")
- [ ] SettingsNav shows two groups: Account (Profile, Notifications) and Workspace (Team, Inboxes, Webhooks, Business hours)
- [ ] Profile section shows current user name/email pre-filled, Save button is disabled when form is unchanged
- [ ] Notifications section shows toggles grouped by In-app / Email / SMS
- [ ] Team section shows agents table with status dots (green/amber/gray) + invite form
- [ ] Inboxes section lists connected channels with channel type label
- [ ] Webhooks section shows existing webhooks + "Add webhook" form with event checkboxes
- [ ] Business hours section shows 7-day schedule grid with timezone select + toggle per day
- [ ] SLA → "Business hours" nav item now shows the real BusinessHoursSection (no more placeholder)
- [ ] `npm run type-check` → 0 errors

✅ All checked? STEP 12 is complete. All screens are now fully built.
