'use client';

import { Suspense } from 'react';
import { BillingWorkspace } from '@/components/billing/BillingWorkspace';
import { Loader2 } from 'lucide-react';

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin" size={28} />
        </div>
      }
    >
      <BillingWorkspace />
    </Suspense>
  );
}
