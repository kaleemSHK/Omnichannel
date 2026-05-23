'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { TicketsWorkspace } from '@/components/tickets/TicketsWorkspace';

export default function TicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin" size={28} />
        </div>
      }
    >
      <TicketsWorkspace />
    </Suspense>
  );
}
