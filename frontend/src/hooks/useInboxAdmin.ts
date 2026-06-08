'use client';

import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as InboxAPI from '@/lib/api/inboxes';
import {
  DEMO_INBOX_DETAILS,
  DEMO_ALL_AGENTS,
  DEMO_INBOX_MEMBERS,
  DEMO_WORKING_HOURS,
} from '@/lib/demo/inboxAdminFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { tenantScopeFromStore } from '@/lib/hooks/useTenantScope';

async function demoDelay(ms = 300): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

function scopedKey(base: string, ...parts: (string | number)[]) {
  const { accountId } = tenantScopeFromStore();
  return [base, accountId, ...parts];
}

export function useInboxDetail(inboxId: number | null) {
  return useQuery({
    queryKey: scopedKey('inbox', inboxId ?? 0),
    enabled: inboxId !== null,
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_INBOX_DETAILS[inboxId!] ?? null;
      return InboxAPI.getInbox(inboxId!);
    },
  });
}

export function useAllAgents() {
  return useQuery({
    queryKey: scopedKey('inbox-agents'),
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_ALL_AGENTS;
      return InboxAPI.listAllAgents();
    },
  });
}

export function useInboxMembers(inboxId: number | null) {
  return useQuery({
    queryKey: scopedKey('inbox-members', inboxId ?? 0),
    enabled: inboxId !== null,
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_INBOX_MEMBERS[inboxId!] ?? [];
      return InboxAPI.getInboxMembers(inboxId!);
    },
  });
}

export function useInboxWorkingHours(inboxId: number | null) {
  return useQuery({
    queryKey: scopedKey('inbox-hours', inboxId ?? 0),
    enabled: inboxId !== null,
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_WORKING_HOURS[inboxId!] ?? [];
      return InboxAPI.getInboxWorkingHours(inboxId!);
    },
  });
}

export function useCreateInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InboxAPI.CreateInboxPayload) => {
      if (isDemoDataEnabled()) {
        await demoDelay();
        return {
          id: 99,
          name: data.name,
          channel_type: data.channel.type,
          working_hours_enabled: data.working_hours_enabled ?? false,
        } satisfies InboxAPI.InboxDetail;
      }
      return InboxAPI.createInbox(data);
    },
    onSuccess: () => {
      const { accountId } = tenantScopeFromStore();
      qc.invalidateQueries({ queryKey: ['inboxes', accountId] });
      toast.success('Inbox created successfully');
    },
    onError: (e: Error) => toast.error(`Failed to create inbox: ${e.message}`),
  });
}

export function useUpdateInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InboxAPI.InboxDetail> }) => {
      if (isDemoDataEnabled()) {
        await demoDelay();
        const existing = DEMO_INBOX_DETAILS[id];
        if (existing) DEMO_INBOX_DETAILS[id] = { ...existing, ...data };
        return { ...existing, ...data } as InboxAPI.InboxDetail;
      }
      return InboxAPI.updateInbox(id, data);
    },
    onSuccess: (_, vars) => {
      const { accountId } = tenantScopeFromStore();
      qc.invalidateQueries({ queryKey: ['inboxes', accountId] });
      qc.invalidateQueries({ queryKey: ['inbox', accountId, vars.id] });
      toast.success('Inbox updated');
    },
    onError: (e: Error) => toast.error(`Failed to update inbox: ${e.message}`),
  });
}

export function useDeleteInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      if (isDemoDataEnabled()) {
        await demoDelay();
        return;
      }
      return InboxAPI.deleteInbox(id);
    },
    onSuccess: () => {
      const { accountId } = tenantScopeFromStore();
      qc.invalidateQueries({ queryKey: ['inboxes', accountId] });
      toast.success('Inbox deleted');
    },
    onError: (e: Error) => toast.error(`Failed to delete inbox: ${e.message}`),
  });
}

export function useUpdateInboxMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ inboxId, userIds }: { inboxId: number; userIds: number[] }) => {
      if (isDemoDataEnabled()) {
        await demoDelay();
        DEMO_INBOX_MEMBERS[inboxId] = DEMO_ALL_AGENTS.filter(a => userIds.includes(a.id));
        return;
      }
      return InboxAPI.updateInboxMembers(inboxId, userIds);
    },
    onSuccess: (_, vars) => {
      const { accountId } = tenantScopeFromStore();
      qc.invalidateQueries({ queryKey: ['inbox-members', accountId, vars.inboxId] });
      toast.success('Agents updated');
    },
    onError: (e: Error) => toast.error(`Failed to update agents: ${e.message}`),
  });
}

export function useUpdateWorkingHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      inboxId,
      hours,
    }: {
      inboxId: number;
      hours: InboxAPI.WorkingHoursDay[];
    }) => {
      if (isDemoDataEnabled()) {
        await demoDelay();
        DEMO_WORKING_HOURS[inboxId] = hours;
        return;
      }
      return InboxAPI.updateInboxWorkingHours(inboxId, hours);
    },
    onSuccess: (_, vars) => {
      const { accountId } = tenantScopeFromStore();
      qc.invalidateQueries({ queryKey: ['inbox-hours', accountId, vars.inboxId] });
      toast.success('Working hours saved');
    },
    onError: (e: Error) => toast.error(`Failed to save hours: ${e.message}`),
  });
}
