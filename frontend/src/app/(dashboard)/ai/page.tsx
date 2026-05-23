'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AIKnowledgeWorkspace } from '@/components/ai/AIKnowledgeWorkspace';

export default function AiPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin" size={28} />
        </div>
      }
    >
      <AIKnowledgeWorkspace />
    </Suspense>
  );
}
