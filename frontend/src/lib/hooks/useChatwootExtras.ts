'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cwFetch } from '@/lib/api/client';
import { assignConversation } from '@/lib/api/conversations';
import { listCannedResponses, listAgents, listLabels } from '@/lib/api/settings';
import { normalizeLabelList } from '@/lib/labels/normalize';
import { DEMO_AGENTS } from '@/lib/demo/settingsFixture';
import {
  DEMO_CANNED_RESPONSES,
  DEMO_LABELS,
  DEMO_TEAMS,
  type DemoCannedResponse,
  type DemoLabel,
  type DemoTeam,
} from '@/lib/demo/chatwootExtrasFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { isFixtureConversationId } from '@/lib/demo/conversationsFixture';
import { useAuthStore } from '@/lib/store/auth';

function accountId() {
  return useAuthStore.getState().user?.chatwootAccountId ?? 1;
}

function filterCanned(list: DemoCannedResponse[], query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return list;
  return list.filter(
    cr => cr.short_code.includes(q) || cr.content.toLowerCase().includes(q),
  );
}

export function useCannedResponses(query: string) {
  return useQuery({
    queryKey: ['cannedResponses', query, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return filterCanned(DEMO_CANNED_RESPONSES, query);
      try {
        const list = await listCannedResponses(query.trim() || undefined);
        const filtered = filterCanned(list, query);
        return filtered.length ? filtered : filterCanned(DEMO_CANNED_RESPONSES, query);
      } catch {
        return filterCanned(DEMO_CANNED_RESPONSES, query);
      }
    },
    staleTime: 30_000,
  });
}

export function useMentionableAgents(query: string) {
  return useQuery({
    queryKey: ['mentionable-agents', query, isDemoDataEnabled()],
    queryFn: async (): Promise<MentionableAgent[]> => {
      const filter = (list: MentionableAgent[]) => {
        const q = query.toLowerCase().trim();
        if (!q) return list;
        return list.filter(
          a =>
            a.name.toLowerCase().includes(q) ||
            a.email.toLowerCase().includes(q),
        );
      };

      if (isDemoDataEnabled()) {
        return filter(DEMO_AGENTS.map(a => ({ id: a.id, name: a.name, email: a.email })));
      }
      try {
        const list = await listAgents();
        const agents = list.map(a => ({ id: a.id, name: a.name, email: a.email }));
        return filter(agents.length ? agents : DEMO_AGENTS.map(a => ({ id: a.id, name: a.name, email: a.email })));
      } catch {
        return filter(DEMO_AGENTS.map(a => ({ id: a.id, name: a.name, email: a.email })));
      }
    },
    staleTime: 60_000,
  });
}

export interface MentionableAgent {
  id: number;
  name: string;
  email: string;
}

export function useLabels() {
  return useQuery({
    queryKey: ['labels', isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_LABELS;
      try {
        const res = await listLabels();
        return normalizeLabelList(res.payload) as DemoLabel[];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });
}

export function useTeams() {
  return useQuery({
    queryKey: ['teams', isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_TEAMS;
      try {
        const res = await cwFetch<{ payload?: DemoTeam[] }>(`/accounts/${accountId()}/teams`);
        return res.payload ?? [];
      } catch {
        return isDemoDataEnabled() ? DEMO_TEAMS : [];
      }
    },
    staleTime: 60_000,
  });
}

export function useConversationLabels(conversationId: number, currentLabels: string[]) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (labels: string[]) => {
      if (isDemoDataEnabled() || isFixtureConversationId(conversationId)) {
        return labels;
      }
      await cwFetch(`/accounts/${accountId()}/conversations/${conversationId}/labels`, {
        method: 'POST',
        body: JSON.stringify({ labels }),
      });
      return labels;
    },
    onSuccess: labels => {
      qc.setQueriesData({ queryKey: ['conversations'] }, (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        const inf = old as { pages?: { data: { id: number; labels: string[] }[] }[] };
        if (!inf.pages) return old;
        return {
          ...inf,
          pages: inf.pages.map(page => ({
            ...page,
            data: page.data.map(c =>
              c.id === conversationId ? { ...c, labels } : c,
            ),
          })),
        };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useSnoozeConversation(conversationId: number) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (snoozedUntil: string) => {
      if (isDemoDataEnabled() || isFixtureConversationId(conversationId)) {
        return snoozedUntil;
      }
      await cwFetch(`/accounts/${accountId()}/conversations/${conversationId}/toggle_status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'snoozed', snoozed_until: snoozedUntil }),
      });
      return snoozedUntil;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useAssignTeam(conversationId: number) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (teamId: string) => {
      if (isDemoDataEnabled() || isFixtureConversationId(conversationId)) {
        const team = DEMO_TEAMS.find(t => String(t.id) === teamId);
        return team ?? null;
      }
      await assignConversation(
        conversationId,
        null,
        teamId ? Number(teamId) : null,
      );
      return teamId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
