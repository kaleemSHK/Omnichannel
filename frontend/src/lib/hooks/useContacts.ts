'use client';

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listContacts,
  searchContacts,
  getContact,
  createContact,
  updateContact,
  getContactConversations,
} from '@/lib/api/contacts';
import { listTickets } from '@/lib/api/tickets';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { DEMO_CONTACTS, filterDemoContacts } from '@/lib/demo/contactsFixture';
import { parseContactsList } from '@/lib/utils/contacts';
import type { CWContact, Ticket } from '@/types';

const PAGE_SIZE = 15;

export function useContactsList(search: string) {
  const trimmed = search.trim();
  return useInfiniteQuery({
    queryKey: ['contacts', trimmed || 'all', isDemoDataEnabled()],
    queryFn: async ({ pageParam = 1 }) => {
      if (isDemoDataEnabled()) {
        const all = filterDemoContacts(trimmed);
        const start = (pageParam - 1) * PAGE_SIZE;
        return {
          contacts: all.slice(start, start + PAGE_SIZE),
          page: pageParam,
        };
      }
      try {
        const res = trimmed
          ? await searchContacts(trimmed, pageParam)
          : await listContacts(pageParam);
        const contacts = parseContactsList(res);
        if (contacts.length) {
          return { contacts, page: pageParam };
        }
      } catch {
        /* demo fallback */
      }
      const all = filterDemoContacts(trimmed);
      const start = (pageParam - 1) * PAGE_SIZE;
      return {
        contacts: all.slice(start, start + PAGE_SIZE),
        page: pageParam,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (last, _all, lastPage) =>
      last.contacts.length >= PAGE_SIZE ? lastPage + 1 : undefined,
  });
}

export function useContact(id: number | null) {
  return useQuery({
    queryKey: ['contact', id, isDemoDataEnabled()],
    queryFn: async () => {
      if (id == null) throw new Error('no id');
      if (isDemoDataEnabled()) {
        const found = DEMO_CONTACTS.find(c => c.id === id);
        if (found) return found;
      }
      try {
        return await getContact(id);
      } catch {
        const found = DEMO_CONTACTS.find(c => c.id === id);
        if (found) return found;
        throw new Error('Contact not found');
      }
    },
    enabled: id != null && id > 0,
  });
}

export function useContactConversations(contactId: number | null) {
  return useQuery({
    queryKey: ['contact-conversations', contactId, isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) {
        return [
          { id: 42, status: 'open', messages: [{ content: 'Fiber upgrade inquiry' }] },
          { id: 55, status: 'pending', messages: [{ content: 'Billing question' }] },
        ];
      }
      try {
        const res = await getContactConversations(contactId!);
        const payload = (res as { payload?: unknown[] }).payload ?? [];
        return payload.slice(0, 5) as Array<{
          id: number;
          status?: string;
          messages?: { content?: string }[];
          last_activity_at?: number;
        }>;
      } catch {
        return [];
      }
    },
    enabled: contactId != null,
  });
}

export function useContactTickets(contactId: number | null) {
  return useQuery({
    queryKey: ['contact-tickets', contactId, isDemoDataEnabled()],
    queryFn: async () => {
      if (!contactId) return [] as Ticket[];
      if (isDemoDataEnabled()) {
        const { DEMO_TICKETS } = await import('@/lib/demo/ticketsFixture');
        return DEMO_TICKETS.filter(t => t.contactId === contactId)
          .slice(0, 5)
          .map(t => ({
            id: t.id,
            tenantId: 'demo',
            subject: t.subject,
            status: t.status === 'resolved' ? 'resolved' : 'open',
            priority:
              t.priority === 'high' ? 'p1' : t.priority === 'low' ? 'p3' : ('p2' as const),
            contactId: String(t.contactId),
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          }));
      }
      try {
        const res = await listTickets({ status: 'open', contact_id: contactId, page: 1 });
        const rows = (res as { data?: Ticket[] }).data ?? [];
        const filtered = rows.filter(
          t => t.contactId != null && Number(t.contactId) === contactId,
        );
        return filtered.slice(0, 5);
      } catch {
        const { DEMO_TICKETS } = await import('@/lib/demo/ticketsFixture');
        return DEMO_TICKETS.filter(t => t.contactId === contactId)
          .slice(0, 5)
          .map(t => ({
            id: t.id,
            tenantId: 'demo',
            subject: t.subject,
            status: 'open' as const,
            priority:
              t.priority === 'high' ? ('p1' as const) : t.priority === 'low' ? ('p3' as const) : ('p2' as const),
            contactId: String(t.contactId),
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          }));
      }
    },
    enabled: contactId != null,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createContact,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateContact>[1] }) =>
      updateContact(id, data),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['contact', id] });
    },
  });
}
