'use client';

import { useQuery } from '@tanstack/react-query';
import { listConversations } from '@/lib/api/conversations';
import { listAgents } from '@/lib/api/settings';
import { DEMO_CONVERSATIONS } from '@/lib/demo/conversationsFixture';
import { DEMO_AGENTS } from '@/lib/demo/settingsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { withDemoOnly } from '@/lib/demo/tenantSettingsQuery';
import { parseConversationList } from '@/lib/utils/conversations';
import { useTenantAccountId } from '@/lib/hooks/useTenantAccountId';
import type { Agent } from '@/lib/api/settings';
import type { CWConversation } from '@/types';

export function conversationOptionLabel(c: CWConversation): string {
  const name = c.meta?.sender?.name?.trim() || 'Unknown contact';
  const status = c.status ?? 'open';
  const priority = c.priority ? ` · ${c.priority}` : '';
  return `#${c.id} — ${name} (${status}${priority})`;
}

export function useDryRunLookups() {
  const demo = isDemoDataEnabled();
  const accountId = useTenantAccountId();

  const conversations = useQuery({
    queryKey: ['dry-run-conversations', accountId, demo],
    enabled: accountId > 0 || demo,
    queryFn: async (): Promise<CWConversation[]> => {
      if (demo) return DEMO_CONVERSATIONS;
      const res = await listConversations({ status: 'open', page: 1 });
      return parseConversationList(res);
    },
    staleTime: 30_000,
  });

  const agents = useQuery({
    queryKey: ['dry-run-agents', accountId, demo],
    enabled: accountId > 0 || demo,
    queryFn: (): Promise<Agent[]> => withDemoOnly(DEMO_AGENTS, () => listAgents()),
    staleTime: 60_000,
  });

  return {
    conversations: conversations.data ?? [],
    agents: agents.data ?? [],
    isLoading: conversations.isLoading || agents.isLoading,
  };
}
