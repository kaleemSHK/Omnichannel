'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useSendTicketMessage } from '@/lib/hooks/useTickets';

interface Props {
  ticketId: string | null;
}

export function TicketReplyBox({ ticketId }: Props) {
  const [content, setContent] = useState('');
  const send = useSendTicketMessage(ticketId);

  const handleSend = async (resolve: boolean) => {
    const text = content.trim();
    if (!text || !ticketId) return;
    await send.mutateAsync({ content: text, resolve });
    setContent('');
  };

  if (!ticketId) return null;

  return (
    <div className="shrink-0 border-t border-gray-100 px-4 py-3 bg-white">
      <textarea
        rows={3}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Reply…"
        className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 outline-none focus:border-[#0B5FFF] resize-none"
      />
      <div className="flex justify-end gap-2 mt-2">
        <button
          type="button"
          disabled={!content.trim() || send.isPending}
          onClick={() => void handleSend(true)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Close & reply
        </button>
        <button
          type="button"
          disabled={!content.trim() || send.isPending}
          onClick={() => void handleSend(false)}
          className="px-4 py-1.5 text-sm bg-[#0B5FFF] text-white rounded-md hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {send.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
          Send
        </button>
      </div>
    </div>
  );
}
