'use client';

import { initials, relativeTime } from '@/lib/utils/conversations';
import { cn } from '@/lib/utils/cn';
import type { CWMessage } from '@/types';

interface Props {
  message: CWMessage;
}

export function MessageBubble({ message }: Props) {
  if (message.message_type === 2) {
    return (
      <div className="text-xs text-center text-muted-foreground py-1">{message.content}</div>
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
          <p dir="auto">{message.content}</p>
          {message.attachments?.map(att => (
            <a
              key={att.id}
              href={att.data_url}
              target="_blank"
              rel="noreferrer"
              className="block text-xs text-brand-primary mt-1 underline"
            >
              Attachment ({att.file_type})
            </a>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1 px-1">
          {relativeTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}
