'use client';

import { MessageSquare, Phone, Mail, Globe, Zap, Bot, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { CWInbox } from '@/types';

export const CHANNEL_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  'Channel::Whatsapp': { label: 'WhatsApp', Icon: MessageSquare, color: 'bg-green-50 text-green-600' },
  'Channel::Email': { label: 'Email', Icon: Mail, color: 'bg-blue-50 text-blue-600' },
  'Channel::WebWidget': { label: 'Web Widget', Icon: Globe, color: 'bg-purple-50 text-purple-600' },
  'Channel::TwilioSms': { label: 'SMS', Icon: Phone, color: 'bg-amber-50 text-amber-600' },
  'Channel::Voice': { label: 'Voice / SIP', Icon: Zap, color: 'bg-rose-50 text-rose-600' },
  'Channel::Api': { label: 'API', Icon: Bot, color: 'bg-gray-50 text-gray-600' },
};

interface InboxCardProps {
  inbox: CWInbox;
  onEdit: (inbox: CWInbox) => void;
  onDelete: (inbox: CWInbox) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export function InboxCard({ inbox, onEdit, onDelete, canEdit, canDelete }: InboxCardProps) {
  const meta = CHANNEL_META[inbox.channel_type] ?? {
    label: inbox.channel_type,
    Icon: MessageSquare,
    color: 'bg-gray-50 text-gray-600',
  };
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
        className={cn(
          'text-xs shrink-0',
          inbox.working_hours_enabled ? 'border-green-300 text-green-700' : '',
        )}
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
