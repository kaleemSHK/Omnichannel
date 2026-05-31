'use client';

import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { ConversationTicketBar } from '@/components/conversations/ConversationTicketBar';
import { MessageBubble } from '@/components/conversations/MessageBubble';
import { ReplyBox } from '@/components/conversations/ReplyBox';
import { LabelPicker } from '@/components/conversations/LabelPicker';
import { SnoozeButton } from '@/components/conversations/SnoozeButton';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  assignConversation,
  listChatwootAgents,
  updateConversationStatus,
} from '@/lib/api/conversations';
import { useMessages } from '@/lib/hooks/useConversations';
import { useAssignTeam, useTeams } from '@/lib/hooks/useChatwootExtras';
import { subscribeToConversation } from '@/lib/api/websocket';
import {
  conversationContactName,
  inboxLabel,
  initials,
} from '@/lib/utils/conversations';
import { useAuthStore } from '@/lib/store/auth';
import { can } from '@/lib/rbac';
import { useQuery } from '@tanstack/react-query';
import { DEMO_AGENTS } from '@/lib/demo/callingFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import type { CWConversation } from '@/types';

interface Props {
  conversation: CWConversation | null;
  onToggleAssist: () => void;
  assistOpen: boolean;
}

export function MessageThread({ conversation, onToggleAssist, assistOpen }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore(s => s.user);
  const role = user?.role;
  const qc = useQueryClient();
  const { data: messages = [], isLoading, isError, error } = useMessages(conversation?.id ?? null);

  const { data: agents = [] } = useQuery({
    queryKey: ['cw-agents', isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) {
        return DEMO_AGENTS.map(a => ({
          id: Number(a.agentId),
          name: a.name,
          email: '',
        }));
      }
      try {
        return await listChatwootAgents();
      } catch {
        return [];
      }
    },
    staleTime: 300_000,
  });

  const { data: teams = [] } = useTeams();
  const teamMutation = useAssignTeam(conversation?.id ?? 0, conversation?.meta?.assignee?.id);

  const statusMutation = useMutation({
    mutationFn: (status: 'open' | 'resolved' | 'pending') =>
      updateConversationStatus(conversation!.id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (assigneeId: string) =>
      assignConversation(
        conversation!.id,
        assigneeId ? Number(assigneeId) : null,
        conversation!.meta?.team?.id ?? null,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, conversation?.id]);

  useEffect(() => {
    if (!conversation || !user?.chatwootAccountId) return;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeToConversation(user.chatwootAccountId, conversation.id, {
        onMessage: () => {
          qc.invalidateQueries({ queryKey: ['messages', conversation.id] });
          qc.invalidateQueries({ queryKey: ['conversations'] });
        },
        onStatusChange: () => {
          qc.invalidateQueries({ queryKey: ['conversations'] });
        },
      });
    } catch (err) {
      console.warn('[MessageThread] subscribeToConversation failed', err);
    }
    return () => unsubscribe?.();
  }, [conversation?.id, user?.chatwootAccountId, qc]);

  if (!conversation) {
    return (
      <div className="flex flex-col flex-1 h-full items-center justify-center text-muted-foreground gap-2 bg-white">
        <MessageSquare className="w-10 h-10 opacity-40" />
        <p className="text-sm">Select a conversation</p>
      </div>
    );
  }

  const contactName = conversationContactName(conversation);
  const channel = inboxLabel(conversation.channel);
  const assigneeValue = conversation.meta?.assignee?.id
    ? String(conversation.meta.assignee.id)
    : '';
  const teamValue = conversation.meta?.team?.id ? String(conversation.meta.team.id) : '';

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-white min-w-0">
      <div className="h-12 border-b flex items-center gap-2 px-4 shrink-0 flex-wrap">
        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center justify-center shrink-0">
          {initials(contactName)}
        </div>
        <span className="font-medium text-sm truncate">{contactName}</span>
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">{channel}</span>

        <LabelPicker conversationId={conversation.id} currentLabels={conversation.labels ?? []} />

        {can(role, 'assignConversation') && (
          <Select
            value={assigneeValue}
            onChange={e => assignMutation.mutate(e.target.value)}
            className="max-w-[120px] text-xs"
            disabled={assignMutation.isPending}
          >
            <option value="">Assign agent…</option>
            {agents.map(a => (
              <option key={a.id} value={String(a.id)}>
                {a.name}
              </option>
            ))}
          </Select>
        )}
        {can(role, 'assignTeam') && (
          <Select
            value={teamValue}
            onChange={e => teamMutation.mutate(e.target.value)}
            className="max-w-[120px] text-xs"
            disabled={teamMutation.isPending}
            title={teams.length === 0 ? 'Create teams in Settings → Teams' : undefined}
          >
            <option value="">No team</option>
            {teams.map(t => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
        {can(role, 'assignTeam') && teams.length === 0 && (
          <span className="text-[10px] text-muted-foreground">No teams — add in Settings</span>
        )}

        <SnoozeButton conversationId={conversation.id} />

        {can(role, 'resolveConversation') &&
          (conversation.status === 'open' || conversation.status === 'pending' ? (
            <Button
              type="button"
              variant="outline"
              className="h-8 text-xs ms-auto"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate('resolved')}
            >
              Resolve
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-8 text-xs border-green-200 text-green-700 hover:bg-green-50 ms-auto"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate('open')}
            >
              Reopen
            </Button>
          ))}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleAssist}
          aria-label={assistOpen ? 'Hide assist panel' : 'Show assist panel'}
          className={can(role, 'resolveConversation') ? '' : 'ms-auto'}
        >
          {assistOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      <ConversationTicketBar conversation={conversation} />

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 px-4 py-4 min-h-0">
        {isError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            Could not load messages: {error instanceof Error ? error.message : 'API error'}
          </p>
        )}
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-2/3 rounded-lg" />
          ))}
        {!isLoading && messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No messages yet</p>
        )}
        {!isLoading && messages.map(m => <MessageBubble key={m.id} message={m} />)}
        <div ref={bottomRef} />
      </div>

      <ReplyBox conversationId={conversation.id} />
    </div>
  );
}
