'use client';

import { useQuery } from '@tanstack/react-query';
import { listInboxes } from '@/lib/api/conversations';
import { DEMO_INBOXES } from '@/lib/demo/inboxesFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, Phone, Mail, Globe, Pencil } from 'lucide-react';

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  'Channel::TwilioSms': Phone,
  'Channel::Whatsapp': MessageSquare,
  'Channel::Email': Mail,
  'Channel::WebWidget': Globe,
  default: MessageSquare,
};

const CHANNEL_LABELS: Record<string, string> = {
  'Channel::TwilioSms': 'SMS',
  'Channel::Whatsapp': 'WhatsApp',
  'Channel::Email': 'Email',
  'Channel::WebWidget': 'Web Widget',
};

export function InboxSection() {
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
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Inboxes</h1>
          <p className="text-sm text-muted-foreground mt-1">Connected channels for your account.</p>
        </div>
        <Button className="bg-brand-primary hover:bg-brand-primary/90 text-sm" size="sm">
          + New inbox
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading
          ? [1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)
          : inboxes.map(inbox => {
              const Icon = CHANNEL_ICONS[inbox.channel_type] ?? CHANNEL_ICONS.default;
              const label = CHANNEL_LABELS[inbox.channel_type] ?? inbox.channel_type;
              return (
                <div
                  key={inbox.id}
                  className="flex items-center gap-3 border rounded-lg px-4 py-3 bg-white hover:bg-muted/20 transition-colors"
                >
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
              );
            })}
      </div>
    </div>
  );
}
