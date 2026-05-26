'use client';

/**
 * ConversationLink — Sprint 2 T01
 *
 * Displays the Chatwoot conversation linked to a ticket.
 * - Shows a badge with the conversation ID and a link to open it
 * - Shows the last 5 timeline entries mirrored from the conversation
 * - Provides a "Link conversation" dialog when no conversation is attached
 */

import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getTicket, linkTicketToConversation } from '@/lib/api/tickets';
import { useAuthStore } from '@/lib/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Ticket, TicketTimelineEntry } from '@/types';
import {
  MessageSquare,
  ExternalLink,
  Link2,
  User,
  Bot,
  ArrowUpRight,
  ArrowDownLeft,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Build a direct URL to the Chatwoot conversation */
function conversationUrl(accountId: number | undefined, conversationId: number): string {
  const base = process.env.NEXT_PUBLIC_CHATWOOT_URL ?? '';
  return accountId
    ? `${base}/app/accounts/${accountId}/conversations/${conversationId}`
    : `${base}/app/conversations/${conversationId}`;
}

// ─── Timeline entry icon/color ────────────────────────────────────────────────

function TimelineEntryRow({ entry }: { entry: TicketTimelineEntry }) {
  const isCustomer = entry.actor === 'customer' || entry.type === 'customer_message';
  const isSystem = entry.actor === 'system' || entry.type === 'activity' || entry.type === 'created';
  const isAgent = !isCustomer && !isSystem;

  return (
    <div className="flex gap-2 text-xs py-1 border-b border-gray-50 last:border-0">
      <div
        className={cn(
          'mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0',
          isCustomer ? 'bg-blue-100 text-blue-600' :
          isSystem   ? 'bg-gray-100 text-gray-500' :
                       'bg-green-100 text-green-600',
        )}
      >
        {isCustomer ? <ArrowDownLeft className="w-3 h-3" /> :
         isSystem   ? <Info className="w-3 h-3" /> :
                      <ArrowUpRight className="w-3 h-3" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-muted-foreground leading-relaxed break-words">{entry.message}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {new Date(entry.at).toLocaleString()} · {entry.actor}
        </p>
      </div>
    </div>
  );
}

// ─── Link-conversation dialog ─────────────────────────────────────────────────

function LinkConversationForm({
  ticketId,
  onLinked,
}: {
  ticketId: string;
  onLinked: (conversationId: number) => void;
}) {
  const [convId, setConvId] = useState('');
  const qc = useQueryClient();

  const link = useMutation({
    mutationFn: () => linkTicketToConversation(ticketId, Number(convId)),
    onSuccess: (ticket) => {
      toast.success(`Linked to conversation #${convId}`);
      void qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
      onLinked(Number(convId));
    },
    onError: () => toast.error('Could not link conversation'),
  });

  return (
    <div className="flex items-end gap-2 mt-2">
      <div className="flex-1 space-y-1">
        <Label className="text-xs text-muted-foreground">Chatwoot conversation ID</Label>
        <Input
          type="number"
          value={convId}
          onChange={(e) => setConvId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && convId && link.mutate()}
          placeholder="e.g. 1234"
          className="h-8 text-sm"
        />
      </div>
      <Button
        size="sm"
        onClick={() => link.mutate()}
        disabled={!convId || !Number.isFinite(Number(convId)) || link.isPending}
        className="h-8 bg-brand-primary hover:bg-brand-primary/90"
      >
        <Link2 className="w-3.5 h-3.5 me-1" />
        {link.isPending ? 'Linking…' : 'Link'}
      </Button>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  ticket: Ticket;
  /** Show the last N timeline entries that came from the conversation (default 5) */
  maxEntries?: number;
}

export function ConversationLink({ ticket, maxEntries = 5 }: Props) {
  const { user } = useAuthStore();
  const accountId = user?.chatwootAccountId ?? ticket.chatwootAccountId;
  const [showLinkForm, setShowLinkForm] = useState(false);

  // Live ticket query to pick up the conversation ID after linking
  const { data: liveTicket } = useQuery<Ticket>({
    queryKey: ['ticket', ticket.id],
    queryFn: () => getTicket(ticket.id),
    initialData: ticket,
    staleTime: 30_000,
  });

  const conversationId = liveTicket?.chatwootConversationId ?? ticket.chatwootConversationId;
  const timeline = (liveTicket?.timeline ?? ticket.timeline ?? [])
    .filter((e) => ['customer_message', 'agent_message', 'comment', 'reply'].includes(e.type))
    .slice(-maxEntries);

  const handleLinked = useCallback(() => {
    setShowLinkForm(false);
  }, []);

  return (
    <div className="rounded-xl border border-gray-100 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <MessageSquare className="w-4 h-4 text-brand-primary" />
          Conversation
        </div>
        {!conversationId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLinkForm(!showLinkForm)}
            className="h-7 text-xs text-muted-foreground"
          >
            <Link2 className="w-3 h-3 me-1" />
            Link conversation
          </Button>
        )}
      </div>

      {/* Linked conversation badge */}
      {conversationId ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 text-xs font-mono">
            <MessageSquare className="w-3 h-3" />
            #{conversationId}
          </Badge>
          <a
            href={conversationUrl(accountId, conversationId)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-brand-primary hover:underline"
          >
            Open in Chatwoot
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No conversation linked. Customer messages from Chatwoot will automatically mirror here once a conversation is linked.
        </p>
      )}

      {/* Link form */}
      {showLinkForm && !conversationId && (
        <LinkConversationForm ticketId={ticket.id} onLinked={handleLinked} />
      )}

      {/* Conversation message thread */}
      {conversationId && timeline.length > 0 && (
        <div className="space-y-0 mt-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Recent messages
          </p>
          {timeline.map((entry, i) => (
            <TimelineEntryRow key={`${entry.at}-${i}`} entry={entry} />
          ))}
          {(liveTicket?.timeline?.length ?? 0) > maxEntries && (
            <p className="text-[10px] text-muted-foreground/60 text-center pt-1">
              {(liveTicket?.timeline?.length ?? 0) - maxEntries} more entries — open conversation for full history
            </p>
          )}
        </div>
      )}

      {conversationId && timeline.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No messages mirrored yet. Incoming customer messages will appear here.
        </p>
      )}
    </div>
  );
}
