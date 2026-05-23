'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ConversationList } from '@/components/conversations/ConversationList';
import { MessageThread } from '@/components/conversations/MessageThread';
import { AgentAssistPanel } from '@/components/conversations/AgentAssistPanel';
import { useInboxStore } from '@/lib/store/inbox';
import { DEMO_CONVERSATIONS } from '@/lib/demo/conversationsFixture';
import type { CWConversation } from '@/types';

function ConversationsContent() {
  const searchParams = useSearchParams();
  const [selectedConversation, setSelectedConversation] = useState<CWConversation | null>(null);
  const [assistOpen, setAssistOpen] = useState(true);
  const setStoreConversationId = useInboxStore(s => s.setSelectedConversationId);

  useEffect(() => {
    const contactId = searchParams.get('contact_id');
    if (!contactId) return;
    const match = DEMO_CONVERSATIONS.find(c => String(c.meta?.sender?.id) === contactId);
    if (match) {
      setSelectedConversation(match);
      setStoreConversationId(match.id);
    }
  }, [searchParams, setStoreConversationId]);

  const handleSelect = (conv: CWConversation) => {
    setSelectedConversation(conv);
    setStoreConversationId(conv.id);
  };

  return (
    <div className="flex h-full overflow-hidden">
      <ConversationList
        selectedId={selectedConversation?.id ?? null}
        onSelect={handleSelect}
      />
      <MessageThread
        conversation={selectedConversation}
        onToggleAssist={() => setAssistOpen(v => !v)}
        assistOpen={assistOpen}
      />
      {assistOpen && selectedConversation && (
        <AgentAssistPanel conversationId={selectedConversation.id} />
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
