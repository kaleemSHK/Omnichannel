'use client';

import { useQuery } from '@tanstack/react-query';
import { getContactConversations } from '@/lib/api/contacts';
import { findContactByPhone } from '@/lib/utils/find-contact-by-phone';
import { getConversation, listConversations, listInboxes } from '@/lib/api/conversations';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { DEMO_CONVERSATIONS } from '@/lib/demo/conversationsFixture';
import { DEMO_INBOXES } from '@/lib/demo/inboxesFixture';
import { conversationSnippet, parseConversationList } from '@/lib/utils/conversations';
import {
  inboxLabelForTransport,
  isJunkCallPhone,
  resolveInboxForTransport,
  type CallTransport,
} from '@/lib/utils/call-inbox-map';
import type { CWConversation, CWInbox } from '@/types';

export interface CallConversationRow {
  id: number;
  status?: string;
  snippet: string;
  lastActivityAt?: number;
  inboxId?: number;
}

export interface CallConversationHistory {
  inbox: CWInbox | null;
  inboxLabel: string;
  conversations: CallConversationRow[];
}

async function loadHistory(
  transport: CallTransport,
  phone: string | null | undefined,
  conversationId: string | null | undefined,
): Promise<CallConversationHistory> {
  const inboxLabel = inboxLabelForTransport(transport);
  if (isDemoDataEnabled()) {
    const inbox = resolveInboxForTransport(DEMO_INBOXES, transport);
    const conversations = DEMO_CONVERSATIONS.filter(c =>
      inbox ? c.inbox_id === inbox.id : true,
    )
      .slice(0, 5)
      .map(c => ({
        id: c.id,
        status: c.status,
        snippet: conversationSnippet(c),
        lastActivityAt: c.last_activity_at,
        inboxId: c.inbox_id,
      }));
    return { inbox, inboxLabel, conversations };
  }

  const inboxes = await listInboxes();
  const inbox = resolveInboxForTransport(inboxes, transport);

  if (conversationId && /^\d+$/.test(conversationId)) {
    try {
      const conv = await getConversation(Number(conversationId));
      return {
        inbox,
        inboxLabel,
        conversations: [
          {
            id: conv.id,
            status: conv.status,
            snippet: conversationSnippet(conv),
            lastActivityAt: conv.last_activity_at,
            inboxId: conv.inbox_id,
          },
        ],
      };
    } catch {
      /* fall through */
    }
  }

  const rows: CallConversationRow[] = [];
  const phoneOk = phone && !isJunkCallPhone(phone);

  if (phoneOk) {
    try {
      const contactId = await findContactByPhone(phone);
      if (contactId) {
        const res = await getContactConversations(contactId);
        const payload = (res.payload ?? []) as Array<{
          id: number;
          status?: string;
          inbox_id?: number;
          last_activity_at?: number;
          messages?: { content?: string }[];
        }>;
        for (const c of payload) {
          if (inbox && c.inbox_id && c.inbox_id !== inbox.id) continue;
          rows.push({
            id: c.id,
            status: c.status,
            snippet: c.messages?.[0]?.content?.slice(0, 80) || `#${c.id}`,
            lastActivityAt: c.last_activity_at,
            inboxId: c.inbox_id,
          });
        }
      }
    } catch {
      /* best-effort */
    }
  }

  if (!rows.length && inbox) {
    try {
      const res = await listConversations({
        inboxId: inbox.id,
        status: 'all',
        page: 1,
        search: phoneOk ? phone.replace(/[^\d+]/g, '') : undefined,
      });
      const payload = parseConversationList(res).slice(0, 5);
      for (const c of payload) {
        rows.push({
          id: c.id,
          status: c.status,
          snippet: conversationSnippet(c),
          lastActivityAt: c.last_activity_at,
          inboxId: c.inbox_id,
        });
      }
    } catch {
      /* best-effort */
    }
  }

  return { inbox, inboxLabel, conversations: rows.slice(0, 5) };
}

export function useCallConversations(opts: {
  transport: CallTransport;
  customerPhone?: string | null;
  conversationId?: string | null;
  enabled?: boolean;
}) {
  const enabled = opts.enabled !== false;
  return useQuery({
    queryKey: [
      'call-conversations',
      opts.transport,
      opts.customerPhone ?? '',
      opts.conversationId ?? '',
      isDemoDataEnabled(),
    ],
    queryFn: () =>
      loadHistory(opts.transport, opts.customerPhone, opts.conversationId ?? undefined),
    enabled,
    staleTime: 30_000,
  });
}
