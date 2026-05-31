'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Link2, Plus, Ticket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { NewTicketModal } from '@/components/tickets/NewTicketModal';
import {
  useLinkTicketToConversation,
  useTicketByConversation,
  useTicketsList,
} from '@/lib/hooks/useTickets';
import { formatTicketDisplayId, mapStatus, ticketSubject } from '@/lib/utils/tickets';
import type { CWConversation } from '@/types';

interface Props {
  conversation: CWConversation;
}

export function ConversationTicketBar({ conversation }: Props) {
  const { data: linkedTicket, isLoading } = useTicketByConversation(conversation.id);
  const { data: tickets = [], isLoading: ticketsLoading } = useTicketsList();
  const linkMutation = useLinkTicketToConversation(conversation.id);
  const [showCreate, setShowCreate] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState('');

  const sender = conversation.meta?.sender;
  const initialContact = sender
    ? { id: sender.id, name: sender.name, email: undefined as string | undefined }
    : undefined;

  const linkableTickets = useMemo(() => {
    const senderId = sender?.id;
    return tickets
      .filter(t => !t.conversationId && t.status !== 'resolved')
      .sort((a, b) => {
        const aSameContact = a.contactId === senderId ? 0 : 1;
        const bSameContact = b.contactId === senderId ? 0 : 1;
        if (aSameContact !== bSameContact) return aSameContact - bSameContact;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [tickets, sender?.id]);

  const handleLink = () => {
    if (!selectedTicketId) return;
    linkMutation.mutate(selectedTicketId, {
      onSuccess: () => {
        setShowLink(false);
        setSelectedTicketId('');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="border-b bg-muted/30 px-4 py-2 shrink-0">
        <Skeleton className="h-6 w-64" />
      </div>
    );
  }

  if (linkedTicket) {
    const ticketId = String(linkedTicket.id);
    const subject = ticketSubject(linkedTicket);
    const status = mapStatus(String(linkedTicket.status ?? 'open'));
    return (
      <div className="border-b bg-blue-50/60 px-4 py-2 flex items-center gap-2 shrink-0 flex-wrap">
        <Ticket className="w-4 h-4 text-brand-primary shrink-0" />
        <span className="text-xs font-mono text-muted-foreground shrink-0">
          {formatTicketDisplayId(ticketId)}
        </span>
        <span className="text-xs font-medium truncate max-w-[240px]">{subject}</span>
        <Badge variant="secondary" className="text-[10px] h-5 capitalize shrink-0">
          {status.replace('_', ' ')}
        </Badge>
        <Link
          href={`/tickets?ticket_id=${encodeURIComponent(ticketId)}`}
          className="ms-auto inline-flex items-center gap-1 text-xs text-brand-primary hover:underline shrink-0"
        >
          Open ticket
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="border-b bg-muted/20 px-4 py-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">No ticket linked</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setShowLink(false);
              setShowCreate(true);
            }}
          >
            <Plus className="w-3 h-3 me-1" />
            Create ticket
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowLink(v => !v)}
          >
            <Link2 className="w-3 h-3 me-1" />
            Link existing
          </Button>
        </div>

        {showLink && (
          <div className="flex items-end gap-2 mt-2 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              {ticketsLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : linkableTickets.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">
                  No open tickets available to link. Create a ticket first.
                </p>
              ) : (
                <Select
                  value={selectedTicketId}
                  onChange={e => setSelectedTicketId(e.target.value)}
                  className="h-8 text-xs w-full"
                >
                  <option value="">Choose a ticket…</option>
                  {linkableTickets.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.displayId} — {t.subject} · {t.contactName}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            {linkableTickets.length > 0 && (
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs shrink-0"
                disabled={!selectedTicketId || linkMutation.isPending}
                onClick={handleLink}
              >
                {linkMutation.isPending ? 'Linking…' : 'Link'}
              </Button>
            )}
          </div>
        )}
      </div>

      <NewTicketModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        initialConversationId={conversation.id}
        initialContact={initialContact}
      />
    </>
  );
}
