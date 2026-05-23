'use client';

import { Loader2 } from 'lucide-react';
import { useTicketMessages } from '@/lib/hooks/useTickets';
import { formatDateTime, initials } from '@/lib/utils/tickets';

interface Props {
  ticketId: string | null;
}

export function TicketThread({ ticketId }: Props) {
  const { data: messages = [], isLoading } = useTicketMessages(ticketId);

  if (!ticketId) return null;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-[200px]">
      {isLoading && (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-gray-400" size={20} />
        </div>
      )}
      {!isLoading &&
        messages.map(m => {
          const outbound = m.direction === 'outbound';
          return (
            <div
              key={m.id}
              className={outbound ? 'flex flex-col items-end gap-1' : 'flex gap-2.5 items-start'}
            >
              {!outbound && (
                <div className="size-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-medium shrink-0">
                  {initials(m.authorName)}
                </div>
              )}
              <div className={outbound ? 'max-w-[75%]' : 'flex-1 min-w-0 max-w-[75%]'}>
                <div className={cnRow(outbound)}>
                  <span className="text-xs font-medium text-gray-700">{m.authorName}</span>
                  <span className="text-[10px] text-gray-400">{formatDateTime(m.createdAt)}</span>
                </div>
                <p
                  dir="auto"
                  className={
                    outbound
                      ? 'mt-1 px-3 py-2 rounded-xl rounded-br-sm bg-blue-50 text-[13px] text-gray-900'
                      : 'mt-1 px-3 py-2 rounded-xl rounded-bl-sm bg-gray-100 text-[13px]'
                  }
                >
                  {m.content}
                </p>
              </div>
              {outbound && (
                <div className="size-8 rounded-full bg-[#0B5FFF]/10 text-[#0B5FFF] flex items-center justify-center text-xs font-medium shrink-0">
                  {initials(m.authorName)}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

function cnRow(outbound: boolean) {
  return outbound
    ? 'flex items-center gap-2 justify-end'
    : 'flex items-center gap-2';
}
