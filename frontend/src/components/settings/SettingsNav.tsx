'use client';

import { cn } from '@/lib/utils/cn';
import { User, Bell, Users, Inbox, Webhook, Clock } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import { can } from '@/lib/rbac';

const NAV_ITEMS = [
  { id: 'profile', label: 'Profile', icon: User, group: 'Account' },
  { id: 'notifications', label: 'Notifications', icon: Bell, group: 'Account' },
  { id: 'team', label: 'Team & Agents', icon: Users, group: 'Workspace' },
  { id: 'inboxes', label: 'Inboxes', icon: Inbox, group: 'Workspace' },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook, group: 'Workspace' },
  { id: 'business-hours', label: 'Business hours', icon: Clock, group: 'Workspace' },
] as const;

export type SettingsView = (typeof NAV_ITEMS)[number]['id'];

interface Props {
  active: SettingsView;
  onChange: (v: SettingsView) => void;
}

export function SettingsNav({ active, onChange }: Props) {
  const role = useAuthStore(s => s.user?.role);

  const visibleNavItems = NAV_ITEMS.filter(item => {
    if (item.id === 'team') return can(role, 'manageTeam');
    if (item.id === 'inboxes') return can(role, 'manageInboxes');
    if (item.id === 'webhooks') return can(role, 'manageWebhooks');
    return true;
  });

  const groups = [...new Set(visibleNavItems.map(i => i.group))];

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
          {visibleNavItems.filter(i => i.group === group).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-start',
                active === id
                  ? 'bg-blue-50 text-brand-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}
