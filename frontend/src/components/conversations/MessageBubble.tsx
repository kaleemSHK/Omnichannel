'use client';

import { initials } from '@/lib/utils/conversations';
import { MessageAttachments } from '@/components/conversations/MessageAttachments';
import { parseMentionSegments } from '@/lib/utils/mentions';
import { useLiveRelativeTime } from '@/hooks/useLiveRelativeTime';
import { cn } from '@/lib/utils/cn';
import type { CWMessage } from '@/types';

interface Props {
  message: CWMessage;
}

function messageTimestampIso(createdAt: number | string): string {
  const ms =
    typeof createdAt === 'number'
      ? createdAt > 1e12
        ? createdAt
        : createdAt * 1000
      : new Date(createdAt).getTime();
  return new Date(ms).toISOString();
}

export function MessageBubble({ message }: Props) {
  const timeLabel = useLiveRelativeTime(message.created_at);

  if (message.message_type === 2) {
    const safe = message.content.replace(/<[^>]+>/g, '').trim();
    return (
      <div className="text-xs text-center text-muted-foreground py-1" aria-live="polite">
        {safe}
      </div>
    );
  }

  const isOutbound = message.message_type === 1;
  const isPrivateNote = message.content_type === 'private_note';
  const senderName = message.sender?.name ?? 'Agent';

  return (
    <div className={cn('flex gap-2 max-w-[75%]', isOutbound ? 'ms-auto flex-row-reverse' : 'me-auto')}>
      {!isOutbound && (
        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center shrink-0 mt-1">
          {initials(senderName)}
        </div>
      )}
      <div>
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm',
            isPrivateNote
              ? 'bg-amber-50 border border-amber-200 rounded-tr-none'
              : isOutbound
                ? 'bg-blue-50 border border-blue-100 rounded-tr-none'
                : 'bg-muted rounded-tl-none',
          )}
        >
          {isPrivateNote && (
            <span className="text-[10px] text-amber-600 font-medium block mb-1">Private note</span>
          )}
          {message.content.trim() ? (
            <p dir="auto" className="whitespace-pre-wrap">
              {isPrivateNote
                ? parseMentionSegments(message.content).map((seg, i) =>
                    seg.type === 'mention' ? (
                      <span key={i} className="font-semibold text-amber-800">
                        @{seg.value}
                      </span>
                    ) : (
                      <span key={i}>{seg.value}</span>
                    ),
                  )
                : message.content}
            </p>
          ) : null}
          {message.attachments && message.attachments.length > 0 && (
            <MessageAttachments attachments={message.attachments} />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 px-1">
          <time dateTime={messageTimestampIso(message.created_at)}>{timeLabel}</time>
        </p>
      </div>
    </div>
  );
}
