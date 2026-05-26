'use client';

/**
 * Sprint 1 G01 — Weighted Skills-Based Routing
 * React Query hooks for skill proficiency CRUD.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listAgentSkills,
  upsertAgentSkill,
  deleteAgentSkill,
  listAgentsWithSkills,
  updateQueueSkillWeights,
} from '@/lib/api/routing';
import type { AgentSkill, AgentWithSkills } from '@/types';

// ─── Single agent skills ──────────────────────────────────────────────────────

export function useAgentSkills(agentId: string) {
  const qc = useQueryClient();

  const query = useQuery<AgentSkill[]>({
    queryKey: ['agentSkills', agentId],
    queryFn: () => listAgentSkills(agentId),
    enabled: !!agentId,
    staleTime: 30_000,
  });

  type UpsertCtx = { prev: AgentSkill[] };
  const upsert = useMutation<void, Error, { skill: string; proficiency: number }, UpsertCtx>({
    mutationFn: ({ skill, proficiency }) => upsertAgentSkill(agentId, skill, proficiency),
    onMutate: async ({ skill, proficiency }) => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: ['agentSkills', agentId] });
      const prev = qc.getQueryData<AgentSkill[]>(['agentSkills', agentId]) ?? [];
      qc.setQueryData<AgentSkill[]>(['agentSkills', agentId], [
        ...prev.filter((s) => s.skill !== skill),
        { skill, proficiency: proficiency as AgentSkill['proficiency'] },
      ]);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(['agentSkills', agentId], ctx.prev);
      }
      toast.error('Failed to update skill');
    },
    onSuccess: () => {
      toast.success('Skill updated');
      void qc.invalidateQueries({ queryKey: ['agentSkills', agentId] });
      void qc.invalidateQueries({ queryKey: ['agentsWithSkills'] });
    },
  });

  type RemoveCtx = { prev: AgentSkill[] };
  const remove = useMutation<void, Error, { skill: string }, RemoveCtx>({
    mutationFn: ({ skill }) => deleteAgentSkill(agentId, skill),
    onMutate: async ({ skill }) => {
      await qc.cancelQueries({ queryKey: ['agentSkills', agentId] });
      const prev = qc.getQueryData<AgentSkill[]>(['agentSkills', agentId]) ?? [];
      qc.setQueryData<AgentSkill[]>(
        ['agentSkills', agentId],
        prev.filter((s) => s.skill !== skill),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(['agentSkills', agentId], ctx.prev);
      }
      toast.error('Failed to remove skill');
    },
    onSuccess: () => {
      toast.success('Skill removed');
      void qc.invalidateQueries({ queryKey: ['agentSkills', agentId] });
      void qc.invalidateQueries({ queryKey: ['agentsWithSkills'] });
    },
  });

  return { ...query, upsert, remove };
}

// ─── All agents with skills ───────────────────────────────────────────────────

export function useAllAgentsWithSkills() {
  return useQuery<AgentWithSkills[]>({
    queryKey: ['agentsWithSkills'],
    queryFn: listAgentsWithSkills,
    staleTime: 30_000,
  });
}

// ─── Queue skill weights ──────────────────────────────────────────────────────

export function useQueueSkillWeights(queueId: string) {
  const qc = useQueryClient();

  const updateWeights = useMutation<
    Awaited<ReturnType<typeof updateQueueSkillWeights>>,
    Error,
    { skillWeights: Record<string, number> }
  >({
    mutationFn: ({ skillWeights }) => updateQueueSkillWeights(queueId, skillWeights),
    onError: () => toast.error('Failed to update skill weights'),
    onSuccess: () => {
      toast.success('Skill weights saved');
      void qc.invalidateQueries({ queryKey: ['queues'] });
    },
  });

  return { updateWeights };
}
