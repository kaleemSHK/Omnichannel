'use client';

import { cn } from '@/lib/utils/cn';
import {
  User,
  Bell,
  Users,
  Inbox,
  Tag,
  Sliders,
  Zap,
  Bot,
  BookOpen,
  MessageSquare,
  Puzzle,
  Building2,
  Webhook,
  Clock,
  Ticket,
  Palette,
  Star,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import { can } from '@/lib/rbac';

const NAV_ITEMS = [
  { id: 'account', label: 'Account Settings', icon: Building2, group: 'Account' },
  { id: 'profile', label: 'Profile', icon: User, group: 'Account' },
  { id: 'notifications', label: 'Notifications', icon: Bell, group: 'Account' },
  { id: 'agents', label: 'Agents', icon: Users, group: 'Workspace' },
  { id: 'teams', label: 'Teams', icon: Users, group: 'Workspace' },
  { id: 'inboxes', label: 'Inboxes', icon: Inbox, group: 'Workspace' },
  { id: 'labels', label: 'Labels', icon: Tag, group: 'Workspace' },
  { id: 'custom-attrs', label: 'Custom Attributes', icon: Sliders, group: 'Workspace' },
  { id: 'ticket-fields', label: 'Ticket Fields', icon: Ticket, group: 'Workspace' },
  { id: 'skills-manager', label: 'Skills Manager', icon: Star, group: 'Workspace' },
  { id: 'automation', label: 'Automation', icon: Zap, group: 'Automation' },
  { id: 'bots', label: 'Agent Bots', icon: Bot, group: 'Automation' },
  { id: 'macros', label: 'Macros', icon: BookOpen, group: 'Automation' },
  { id: 'canned', label: 'Canned Responses', icon: MessageSquare, group: 'Automation' },
  { id: 'branding', label: 'Branding', icon: Palette, group: 'Platform' },
  { id: 'integrations', label: 'Integrations', icon: Puzzle, group: 'Integrations' },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook, group: 'Integrations' },
  { id: 'business-hours', label: 'Business Hours', icon: Clock, group: 'Integrations' },
] as const;

export type SettingsView = (typeof NAV_ITEMS)[number]['id'];

interface Props {
  active: SettingsView;
  onChange: (v: SettingsView) => void;
}

export function SettingsNav({ active, onChange }: Props) {
  const role = useAuthStore(s => s.user?.role);

  const visible = NAV_ITEMS.filter(item => {
    if (item.id === 'account') return can(role, 'manageTeam');
    if (item.id === 'agents') return can(role, 'manageTeam');
    if (item.id === 'teams') return can(role, 'manageTeam');
    if (item.id === 'inboxes') return can(role, 'manageInboxes');
    if (item.id === 'labels') return can(role, 'manageInboxes');
    if (item.id === 'custom-attrs') return can(role, 'manageInboxes');
    if (item.id === 'ticket-fields') return can(role, 'manageInboxes');
    if (item.id === 'skills-manager') return can(role, 'manageTeam');
    if (item.id === 'automation') return can(role, 'manageInboxes');
    if (item.id === 'bots') return can(role, 'manageInboxes');
    if (item.id === 'macros') return true;
    if (item.id === 'canned') return true;
    if (item.id === 'integrations') return can(role, 'manageInboxes');
    if (item.id === 'webhooks') return can(role, 'manageWebhooks');
    if (item.id === 'branding') return can(role, 'manageTeam');
    return true;
  });

  const groups = [...new Set(visible.map(i => i.group))];

  return (
    <aside className="w-[220px] border-e h-full flex flex-col py-4 px-2 shrink-0 bg-muted/20 overflow-y-auto">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-3">
        Settings
      </h2>
      {groups.map(group => (
        <div key={group} className="mb-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
            {group}
          </p>
          {visible
            .filter(i => i.group === group)
            .map(({ id, label, icon: Icon }) => (
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
