'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ContactsWorkspace } from '@/components/contacts/ContactsWorkspace';

export default function ContactsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="animate-spin" size={28} />
        </div>
      }
    >
      <ContactsWorkspace />
    </Suspense>
  );
}
