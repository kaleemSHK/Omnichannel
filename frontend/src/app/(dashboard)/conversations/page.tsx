'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ConversationList } from '@/components/conversations/ConversationList';
import { MessageThread } from '@/components/conversations/MessageThread';
import { AgentAssistPanel } from '@/components/conversations/AgentAssistPanel';
import { useInboxStore } from '@/lib/store/inbox';
import { getConversation } from '@/lib/api/conversations';
import { useMarkConversationRead } from '@/lib/hooks/useConversations';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { DEMO_CONVERSATIONS } from '@/lib/demo/conversationsFixture';
import type { CWConversation } from '@/types';

function useIsMdScreen() {
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : true,
  );
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1280px)');
    const handler = (e: MediaQueryListEvent) => setWide(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return wide;
}

function ConversationsContent() {
  const searchParams = useSearchParams();
  const [selectedConversation, setSelectedConversation] = useState<CWConversation | null>(null);
  const isWide = useIsMdScreen();
  const [assistOpen, setAssistOpen] = useState(isWide);
  const setStoreConversationId = useInboxStore(s => s.setSelectedConversationId);
  const markRead = useMarkConversationRead();

  useEffect(() => {
    const convId = searchParams.get('conversation_id');
    if (convId && !isDemoDataEnabled()) {
      getConversation(Number(convId))
        .then(conv => {
          markRead.mutate(conv.id);
          setSelectedConversation({ ...conv, unread_count: 0 });
          setStoreConversationId(conv.id);
        })
        .catch(() => {
          /* ignore */
        });
      return;
    }

    const contactId = searchParams.get('contact_id');
    if (!contactId) return;
    if (isDemoDataEnabled()) {
      const match = DEMO_CONVERSATIONS.find(c => String(c.meta?.sender?.id) === contactId);
      if (match) {
        setSelectedConversation(match);
        setStoreConversationId(match.id);
      }
    }
  }, [searchParams, setStoreConversationId, markRead]);

  useEffect(() => {
    setAssistOpen(isWide);
  }, [isWide]);

  const handleSelect = useCallback(
    (conv: CWConversation) => {
      markRead.mutate(conv.id);
      setSelectedConversation({ ...conv, unread_count: 0 });
      setStoreConversationId(conv.id);
    },
    [setStoreConversationId, markRead],
  );

  return (
    <div className="flex h-full overflow-hidden">
      <ConversationList selectedId={selectedConversation?.id ?? null} onSelect={handleSelect} />
      <MessageThread
        conversation={selectedConversation}
        onToggleAssist={() => setAssistOpen(v => !v)}
        assistOpen={assistOpen}
      />
      {assistOpen && selectedConversation && (
        <AgentAssistPanel
          conversationId={selectedConversation.id}
          contactId={selectedConversation.meta?.sender?.id}
        />
      )}
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={null}>
      <ConversationsContent />
    </Suspense>
  );
}
