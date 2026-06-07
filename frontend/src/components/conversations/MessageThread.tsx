'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Check,
  RefreshCw,
  UserCheck,
  Users,
  MoreHorizontal,
  Copy,
  ExternalLink,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConversationTicketBar } from '@/components/conversations/ConversationTicketBar';
import { ConversationIncomingCallBanner } from '@/components/conversations/ConversationIncomingCallBanner';
import { MessageBubble } from '@/components/conversations/MessageBubble';
import { ReplyBox } from '@/components/conversations/ReplyBox';
import { LabelPicker } from '@/components/conversations/LabelPicker';
import { MacroPicker } from '@/components/conversations/MacroPicker';
import { PriorityPicker } from '@/components/conversations/PriorityPicker';
import { SnoozeButton } from '@/components/conversations/SnoozeButton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  assignConversation,
  listChatwootAgents,
  updateConversationStatus,
} from '@/lib/api/conversations';
import { useMarkConversationRead, useMessages, useConversationDetail } from '@/lib/hooks/useConversations';
import { useAssignTeam, useTeams } from '@/lib/hooks/useChatwootExtras';
import { subscribeToConversation } from '@/lib/api/websocket';
import {
  conversationContactName,
  inboxLabel,
  initials,
} from '@/lib/utils/conversations';
import { useAuthStore } from '@/lib/store/auth';
import { can } from '@/lib/rbac';
import { DEMO_AGENTS } from '@/lib/demo/callingFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { cn } from '@/lib/utils/cn';
import type { ConversationPriority, CWConversation } from '@/types';

const PRIORITY_HEADER: Record<ConversationPriority, string> = {
  none: '',
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

// ─── Assign dropdown (agent / team) ────────────────────────────────────────────

function AssignDropdown({
  label,
  placeholder,
  icon: Icon,
  currentName,
  currentId,
  options,
  onSelect,
  disabled,
}: {
  label: string;
  placeholder: string;
  icon: React.ElementType;
  currentName?: string;
  currentId?: string;
  options: { id: string; name: string }[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));
  const display = currentName ?? placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={currentName ? `${label}: ${currentName}` : placeholder}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors max-w-[160px]',
            currentName
              ? 'border-brand-primary/30 bg-blue-50 text-brand-primary font-medium'
              : 'border-gray-200 text-muted-foreground hover:bg-gray-50',
          )}
        >
          <Icon className="w-3 h-3 shrink-0" />
          <span className="truncate">{display}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1.5" align="start">
        <p className="text-[10px] font-semibold text-muted-foreground px-2 pb-1">{label}</p>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${label.toLowerCase()}…`}
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md mb-1.5 focus:outline-none"
          autoFocus
        />
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          <button
            type="button"
            onClick={() => { onSelect(''); setOpen(false); setSearch(''); }}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-gray-50',
              !currentId ? 'bg-muted/60 font-medium text-foreground' : 'text-muted-foreground',
            )}
          >
            Unassigned
            {!currentId && <span className="ms-auto text-brand-primary">✓</span>}
          </button>
          {filtered.map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => { onSelect(o.id); setOpen(false); setSearch(''); }}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-gray-50 text-start',
                currentId === o.id && 'bg-muted/60 font-medium',
              )}
            >
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                {initials(o.name)}
              </div>
              <span className="truncate">{o.name}</span>
              {currentId === o.id && (
                <span className="ms-auto text-brand-primary">✓</span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-2 text-center">No results</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  open:     'bg-green-100 text-green-700',
  pending:  'bg-amber-100 text-amber-700',
  resolved: 'bg-gray-100 text-gray-500',
  snoozed:  'bg-purple-100 text-purple-700',
};

// ─── More actions menu ─────────────────────────────────────────────────────────

function MoreActions({ conversation }: { conversation: CWConversation }) {
  const [open, setOpen] = useState(false);
  const convUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/conversations?conversation_id=${conversation.id}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="p-1.5 rounded-md text-muted-foreground hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="More actions"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="end">
        <button
          type="button"
          onClick={() => { navigator.clipboard?.writeText(String(conversation.id)); toast.success('ID copied'); setOpen(false); }}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-gray-50 text-start"
        >
          <Copy className="w-3 h-3 text-muted-foreground" />
          Copy conversation ID
        </button>
        <button
          type="button"
          onClick={() => { navigator.clipboard?.writeText(convUrl); toast.success('Link copied'); setOpen(false); }}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-gray-50 text-start"
        >
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
          Copy link
        </button>
        {conversation.meta?.sender?.phone_number && (
          <button
            type="button"
            onClick={() => { navigator.clipboard?.writeText(conversation.meta.sender.phone_number!); toast.success('Phone copied'); setOpen(false); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-gray-50 text-start"
          >
            <Phone className="w-3 h-3 text-muted-foreground" />
            Copy phone number
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col flex-1 h-full items-center justify-center gap-3 bg-gray-50/50">
      <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
        <MessageSquare className="w-7 h-7 text-gray-300" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">No conversation selected</p>
        <p className="text-xs text-muted-foreground mt-0.5">Pick one from the list to start</p>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  conversation: CWConversation | null;
  onToggleAssist: () => void;
  assistOpen: boolean;
}

export function MessageThread({ conversation, onToggleAssist, assistOpen }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const markedReadRef = useRef<number | null>(null);
  const user = useAuthStore(s => s.user);
  const role = user?.role;
  const qc = useQueryClient();
  const conversationId = conversation?.id ?? null;
  const { data: detail } = useConversationDetail(conversationId);
  const conv = detail ?? conversation;
  const markRead = useMarkConversationRead();
  const { data: messages = [], isLoading, isError, error } = useMessages(conversationId);

  const refreshConversation = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['conversations'] });
    if (conversationId) qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
  }, [qc, conversationId]);

  const { data: agents = [] } = useQuery({
    queryKey: ['cw-agents', isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) {
        return DEMO_AGENTS.map(a => ({ id: Number(a.agentId), name: a.name, email: '' }));
      }
      try { return await listChatwootAgents(); }
      catch { return []; }
    },
    staleTime: 300_000,
  });

  const { data: teams = [] } = useTeams();
  const teamMutation = useAssignTeam(conversationId ?? 0, conv?.meta?.assignee?.id);

  const statusMutation = useMutation({
    mutationFn: (status: 'open' | 'resolved' | 'pending') =>
      updateConversationStatus(conv!.id, status),
    onSuccess: refreshConversation,
  });

  const assignMutation = useMutation({
    mutationFn: (assigneeId: string) =>
      assignConversation(
        conv!.id,
        assigneeId ? Number(assigneeId) : null,
        conv!.meta?.team?.id ?? null,
      ),
    onSuccess: refreshConversation,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, conversation?.id]);

  useEffect(() => {
    if (!conversationId) return;
    if (markedReadRef.current === conversationId) return;
    markedReadRef.current = conversationId;
    markRead.mutate(conversationId);
  }, [conversationId, markRead]);

  useEffect(() => {
    if (!conversationId || !user?.chatwootAccountId) return;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeToConversation(user.chatwootAccountId, conversationId, {
        onMessage: () => {
          qc.invalidateQueries({ queryKey: ['messages', conversationId] });
          qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
          markRead.mutate(conversationId);
        },
        onStatusChange: refreshConversation,
      });
    } catch (err) {
      console.warn('[MessageThread] subscribeToConversation failed', err);
    }
    return () => unsubscribe?.();
  }, [conversationId, user?.chatwootAccountId, qc, markRead, refreshConversation]);

  if (!conv) return <EmptyState />;

  const contactName = conversationContactName(conv);
  const channel = inboxLabel(conv.channel);
  const contactInitials = initials(contactName);
  const assigneeName = conv.meta?.assignee?.name;
  const assigneeId = conv.meta?.assignee?.id ? String(conv.meta.assignee.id) : undefined;
  const teamName = conv.meta?.team?.name;
  const teamId = conv.meta?.team?.id ? String(conv.meta.team.id) : undefined;
  const status = conv.status ?? 'open';
  const priority = conv.priority && conv.priority !== 'none' ? conv.priority : null;

  const agentOptions = agents.map(a => ({ id: String(a.id), name: a.name }));
  const teamOptions = teams.map(t => ({ id: String(t.id), name: t.name }));

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-white min-w-0">
      {/* ── Header ── */}
      <div className="shrink-0 border-b bg-white">
        {/* Top row */}
        <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
          {/* Contact avatar + name */}
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0">
            {contactInitials}
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-semibold text-sm text-gray-900 truncate">{contactName}</span>
            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium shrink-0">
              {channel}
            </span>
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize shrink-0',
              STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-500',
            )}>
              {status}
            </span>
            {priority && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize shrink-0',
                PRIORITY_HEADER[priority],
              )}>
                {priority}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
              #{conv.id}
            </span>
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 px-4 pb-2 flex-wrap">
          {/* Labels */}
          <LabelPicker conversationId={conv.id} currentLabels={conv.labels ?? []} />

          {/* Priority */}
          <PriorityPicker
            conversationId={conv.id}
            currentPriority={conv.priority}
          />

          {/* Macros */}
          <MacroPicker conversationId={conv.id} />

          {/* Assign agent */}
          {can(role, 'assignConversation') && (
            <AssignDropdown
              label="Agent"
              placeholder="Assign agent"
              icon={UserCheck}
              currentName={assigneeName}
              currentId={assigneeId}
              options={agentOptions}
              onSelect={id => assignMutation.mutate(id)}
              disabled={assignMutation.isPending}
            />
          )}

          {/* Assign team */}
          {can(role, 'assignTeam') && (
            <AssignDropdown
              label="Team"
              placeholder="Assign team"
              icon={Users}
              currentName={teamName}
              currentId={teamId}
              options={teamOptions}
              onSelect={id => teamMutation.mutate(id)}
              disabled={teamMutation.isPending}
            />
          )}

          {/* Snooze */}
          <SnoozeButton conversationId={conv.id} />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Status action */}
          {can(role, 'resolveConversation') && (
            status === 'open' || status === 'pending' ? (
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1 shrink-0"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate('resolved')}
              >
                <Check className="w-3 h-3" />
                Resolve
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 shrink-0"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate('open')}
              >
                <RefreshCw className="w-3 h-3" />
                Reopen
              </Button>
            )
          )}

          {/* More actions */}
          <MoreActions conversation={conv} />

          {/* Toggle assist panel */}
          <button
            type="button"
            onClick={onToggleAssist}
            aria-label={assistOpen ? 'Hide assist panel' : 'Show assist panel'}
            className="p-1.5 rounded-md text-muted-foreground hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {assistOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <ConversationTicketBar conversation={conv} />
      <ConversationIncomingCallBanner conversation={conv} />

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 px-4 py-4 min-h-0 bg-gray-50/30">
        {isError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            Could not load messages: {error instanceof Error ? error.message : 'API error'}
          </p>
        )}
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className={cn('h-12 rounded-xl', i % 2 === 0 ? 'w-2/3' : 'w-2/3 ms-auto')} />
        ))}
        {!isLoading && messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-12">
            <MessageSquare className="w-8 h-8 text-gray-200" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
          </div>
        )}
        {!isLoading && messages.map(m => <MessageBubble key={m.id} message={m} />)}
        <div ref={bottomRef} />
      </div>

      <ReplyBox conversationId={conv.id} />
    </div>
  );
}
