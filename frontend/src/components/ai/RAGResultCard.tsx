'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { scorePercent, type RagQueryResult } from '@/lib/utils/ai';
import { useInboxStore } from '@/lib/store/inbox';

interface Props {
  result: RagQueryResult;
}

export function RAGResultCard({ result }: Props) {
  const router = useRouter();
  const selectedConversationId = useInboxStore(s => s.selectedConversationId);
  const insertSnippet = useInboxStore(s => s.insertReplySnippet);

  const pct = scorePercent(result.score);

  const handleInsert = () => {
    if (!selectedConversationId) {
      toast.message('Open a conversation to insert this snippet');
      router.push('/conversations');
      return;
    }
    insertSnippet(result.excerpt);
    toast.success('Inserted into reply');
    router.push('/conversations');
  };

  return (
    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-[#0B5FFF]">
          {pct}% match
        </span>
        {selectedConversationId != null && (
          <button
            type="button"
            onClick={handleInsert}
            className="text-xs text-[#0B5FFF] hover:underline shrink-0"
          >
            Insert to reply
          </button>
        )}
      </div>
      <p className="text-sm text-gray-800 line-clamp-4">{result.excerpt}</p>
      <p className="text-xs text-gray-500 mt-2">
        {result.filename}
        {result.page != null ? ` · page ${result.page}` : ''}
      </p>
    </div>
  );
}
