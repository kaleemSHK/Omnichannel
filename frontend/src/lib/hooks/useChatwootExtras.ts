'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cwFetch } from '@/lib/api/client';
import { assignConversation } from '@/lib/api/conversations';
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

export function useCannedResponses(query: string) {
  return useQuery({
    queryKey: ['cannedResponses', query, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) {
        const q = query.toLowerCase();
        return DEMO_CANNED_RESPONSES.filter(
          cr => cr.short_code.includes(q) || cr.content.toLowerCase().includes(q),
        );
      }
      try {
        const res = await cwFetch<{ payload?: DemoCannedResponse[] }>(
          `/accounts/${accountId()}/canned_responses?search=${encodeURIComponent(query)}`,
        );
        return res.payload ?? [];
      } catch {
        return DEMO_CANNED_RESPONSES;
      }
    },
    enabled: query.length >= 1,
  });
}

export function useLabels() {
  return useQuery({
    queryKey: ['labels', isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_LABELS;
      try {
        const res = await cwFetch<{ payload?: DemoLabel[] }>(`/accounts/${accountId()}/labels`);
        return res.payload ?? DEMO_LABELS;
      } catch {
        return DEMO_LABELS;
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
        return res.payload ?? DEMO_TEAMS;
      } catch {
        return DEMO_TEAMS;
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
