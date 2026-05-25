'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ContactList } from '@/components/contacts/ContactList';
import { ContactDetailPanel } from '@/components/contacts/ContactDetailPanel';
import { ContactForm } from '@/components/contacts/ContactForm';
import { Sheet } from '@/components/ui/Sheet';
import type { CWContact } from '@/types';

export function ContactsWorkspace() {
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editContact, setEditContact] = useState<CWContact | undefined>();

  useEffect(() => {
    const fromUrl = searchParams.get('contact_id');
    if (fromUrl) {
      const id = Number(fromUrl);
      if (Number.isFinite(id) && id > 0) setSelectedId(id);
    }
  }, [searchParams]);

  const handleFirstContact = useCallback((id: number) => {
    setSelectedId(prev => prev ?? id);
  }, []);

  const openCreate = () => {
    setEditContact(undefined);
    setSheetOpen(true);
  };

  const openEdit = (contact: CWContact) => {
    setEditContact(contact);
    setSheetOpen(true);
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)] overflow-hidden bg-surface-tertiary">
      <ContactList
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNewContact={openCreate}
        onFirstContact={handleFirstContact}
      />
      <div className="flex-1 bg-white min-w-0">
        <ContactDetailPanel contactId={selectedId} onEdit={openEdit} />
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editContact ? 'Edit contact' : 'New contact'}
      >
        <ContactForm contact={editContact} onDone={() => setSheetOpen(false)} />
      </Sheet>
    </div>
  );
}
