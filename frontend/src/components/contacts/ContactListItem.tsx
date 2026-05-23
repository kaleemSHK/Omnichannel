'use client';

import { cn } from '@/lib/utils/cn';
import {
  contactAvatarClass,
  contactInitials,
  contactSlaTier,
  slaTierBadgeClass,
} from '@/lib/utils/contacts';
import type { CWContact } from '@/types';

interface Props {
  contact: CWContact;
  selected?: boolean;
  onSelect?: () => void;
}

export function ContactListItem({ contact, selected, onSelect }: Props) {
  const tier = contactSlaTier(contact);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-start px-3 py-2.5 flex gap-2.5 border-s-2 transition-colors',
        selected ? 'bg-blue-50 border-s-brand-primary' : 'border-s-transparent hover:bg-muted',
      )}
    >
      <div
        className={cn(
          'size-9 shrink-0 rounded-full flex items-center justify-center text-xs font-medium',
          contactAvatarClass(contact.name),
        )}
      >
        {contactInitials(contact.name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{contact.name}</p>
        {contact.phone_number && (
          <p className="text-sm text-muted-foreground truncate">{contact.phone_number}</p>
        )}
        {contact.company?.name && (
          <p className="text-xs text-muted-foreground truncate">{contact.company.name}</p>
        )}
      </div>
      <span
        className={cn(
          'shrink-0 self-start px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize',
          slaTierBadgeClass(tier),
        )}
      >
        {tier}
      </span>
    </button>
  );
}
