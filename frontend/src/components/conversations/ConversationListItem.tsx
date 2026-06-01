'use client';

import {
  Mail,
  MessageCircle,
  MessageSquare,
  Smartphone,
  Globe,
  AtSign,
  Send,
} from 'lucide-react';
import {
  conversationContactName,
  conversationSnippet,
  initials,
  relativeTime,
} from '@/lib/utils/conversations';
import { labelColor } from './ConversationList';
import { cn } from '@/lib/utils/cn';
import { useSentimentStore } from '@/lib/store/sentiment';
import type { CWConversation } from '@/types';

// ─── Channel icon ──────────────────────────────────────────────────────────────

interface ChannelConfig {
  icon: React.ElementType;
  label: string;
  cls: string;
}

const CHANNEL_CONFIG: Record<string, ChannelConfig> = {
  'Channel::Whatsapp': { icon: MessageCircle, label: 'WhatsApp',  cls: 'bg-green-100 text-green-700' },
  'Channel::Email':    { icon: Mail,          label: 'Email',     cls: 'bg-gray-100 text-gray-600' },
  'Channel::WebWidget':{ icon: MessageSquare, label: 'Chat',      cls: 'bg-blue-100 text-blue-700' },
  'Channel::Twitter':  { icon: AtSign,        label: 'Twitter',   cls: 'bg-sky-100 text-sky-700' },
  'Channel::Telegram': { icon: Send,          label: 'Telegram',  cls: 'bg-blue-100 text-blue-600' },
  'Channel::Sms':      { icon: Smartphone,    label: 'SMS',       cls: 'bg-orange-100 text-orange-700' },
  'Channel::Api':      { icon: Globe,         label: 'API',       cls: 'bg-purple-100 text-purple-700' },
};

const DEFAULT_CHANNEL: ChannelConfig = {
  icon: MessageSquare, label: 'Chat', cls: 'bg-gray-100 text-gray-500',
};

function ChannelBadge({ channel }: { channel?: string }) {
  const cfg = CHANNEL_CONFIG[channel ?? ''] ?? DEFAULT_CHANNEL;
  const Icon = cfg.icon;
  return (
    <span
      className={cn('inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full', cfg.cls)}
      title={cfg.label}
    >
      <Icon className="w-2.5 h-2.5 shrink-0" />
      {cfg.label}
    </span>
  );
}

// ─── Sentiment indicator ────────────────────────────────────────────────────────

const SENTIMENT_EMOJI: Record<string, string> = {
  positive: '😊',
  negative: '😟',
};

// ─── Avatar colours (per-name hash) ────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
  conversation: CWConversation;
  selected: boolean;
  onClick: () => void;
}

export function ConversationListItem({ conversation, selected, onClick }: Props) {
  const name     = conversationContactName(conversation);
  const snippet  = conversationSnippet(conversation);
  const lastActive = relativeTime(conversation.last_activity_at);
  const labels   = conversation.labels ?? [];
  const unread   = conversation.unread_count ?? 0;
  const assignee = conversation.meta?.assignee;
  const lastSentiment = useSentimentStore(s => s.byConversation[conversation.id]);

  const contactInitials = initials(name);
  const contactColor    = avatarColor(name);

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={`Conversation with ${name}, ${lastActive}`}
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors text-start border-b border-gray-50 last:border-0',
        selected
          ? 'bg-blue-50 border-s-2 border-brand-primary'
          : 'hover:bg-gray-50 border-s-2 border-transparent',
        unread > 0 && !selected && 'bg-blue-50/30',
      )}
    >
      {/* Avatar */}
      <div className={cn(
        'w-9 h-9 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5',
        contactColor,
      )}>
        {contactInitials}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Row 1: name + time + unread */}
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={cn(
            'text-sm truncate flex-1',
            unread > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-800',
          )}>
            {name}
          </span>
          {lastSentiment && lastSentiment !== 'neutral' && (
            <span className="shrink-0 text-[11px]" title={`Sentiment: ${lastSentiment}`}>
              {SENTIMENT_EMOJI[lastSentiment]}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
            {lastActive}
          </span>
        </div>

        {/* Row 2: channel badge + assignee + unread badge */}
        <div className="flex items-center gap-1.5 mb-1">
          <ChannelBadge channel={conversation.channel} />
          {assignee && (
            <span
              className="text-[9px] bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 font-medium truncate max-w-[60px]"
              title={`Assigned to ${assignee.name}`}
            >
              {assignee.name.split(' ')[0]}
            </span>
          )}
          {unread > 0 && (
            <span className="ms-auto shrink-0 bg-brand-primary text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>

        {/* Row 3: snippet */}
        {snippet && (
          <p className={cn(
            'text-xs truncate',
            unread > 0 ? 'text-gray-700' : 'text-muted-foreground',
          )}>
            {snippet}
          </p>
        )}

        {/* Row 4: labels */}
        {labels.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1">
            {labels.slice(0, 3).map(l => (
              <span
                key={l}
                className={cn(
                  'text-[9px] px-1.5 py-0.5 rounded-full font-medium',
                  labelColor(l),
                )}
              >
                {l}
              </span>
            ))}
            {labels.length > 3 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                +{labels.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
