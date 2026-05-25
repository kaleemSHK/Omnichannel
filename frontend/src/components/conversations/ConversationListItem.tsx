'use client';

import {
  conversationContactName,
  conversationSnippet,
  inboxLabel,
  initials,
  relativeTime,
} from '@/lib/utils/conversations';
import { cn } from '@/lib/utils/cn';
import type { CWConversation } from '@/types';

interface Props {
  conversation: CWConversation;
  selected: boolean;
  onClick: () => void;
}

export function ConversationListItem({ conversation, selected, onClick }: Props) {
  const name = conversationContactName(conversation);
  const snippet = conversationSnippet(conversation);
  const channel = inboxLabel(conversation.channel);
  const lastActive = relativeTime(conversation.last_activity_at);

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={`Conversation with ${name}, ${channel}, ${lastActive}`}
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors text-start',
        selected
          ? 'bg-blue-50 border-s-2 border-brand-primary'
          : 'hover:bg-muted border-s-2 border-transparent',
      )}
    >
      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center justify-center shrink-0">
        {initials(name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{name}</span>
          <span className="text-xs text-muted-foreground ms-auto shrink-0">
            {relativeTime(conversation.last_activity_at)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{channel}</span>
          {conversation.unread_count > 0 && (
            <span className="bg-brand-primary text-white text-xs rounded-full px-1.5 min-w-[18px] text-center">
              {conversation.unread_count}
            </span>
          )}
        </div>
        {snippet && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">{snippet}</p>
        )}
      </div>
    </button>
  );
}
