'use client';

import { Phone, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  contactAvatarClass,
  contactDisplayName,
  contactInitials,
  contactSlaTier,
  slaTierBadgeClass,
} from '@/lib/utils/contacts';
import type { CWContact } from '@/types';

// ─── Label colour (hash-based) ─────────────────────────────────────────────────

const LABEL_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
];

function labelColor(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return LABEL_COLORS[h % LABEL_COLORS.length]!;
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
  contact: CWContact;
  selected?: boolean;
  onSelect?: () => void;
}

export function ContactListItem({ contact, selected, onSelect }: Props) {
  const tier = contactSlaTier(contact);
  const displayName = contactDisplayName(contact);
  const labels = (contact.labels ?? []).filter(l => !['gold', 'silver', 'bronze', 'vip'].includes(l.toLowerCase()));

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={displayName}
      onClick={onSelect}
      className={cn(
        'w-full text-start px-3 py-2.5 flex gap-2.5 border-s-2 transition-colors group border-b border-gray-50 last:border-0',
        selected
          ? 'bg-blue-50 border-s-brand-primary'
          : 'border-s-transparent hover:bg-gray-50',
      )}
    >
      {/* Avatar */}
      <div className={cn(
        'size-10 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5',
        contactAvatarClass(displayName),
      )}>
        {contactInitials(displayName)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm font-medium text-gray-900 truncate flex-1">{displayName}</span>
          <span className={cn(
            'shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-semibold capitalize',
            slaTierBadgeClass(tier),
          )}>
            {tier}
          </span>
        </div>

        {contact.phone_number ? (
          <p className="text-xs text-muted-foreground truncate">{contact.phone_number}</p>
        ) : contact.email ? (
          <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
        ) : null}

        {contact.company?.name && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{contact.company.name}</p>
        )}

        {labels.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1">
            {labels.slice(0, 2).map(l => (
              <span key={l} className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium', labelColor(l))}>
                {l}
              </span>
            ))}
            {labels.length > 2 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                +{labels.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hover quick actions */}
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 justify-center">
        {contact.phone_number && (
          <span title="Call" className="p-1 rounded-md bg-blue-50 text-blue-600">
            <Phone className="w-3 h-3" />
          </span>
        )}
        <span title="Message" className="p-1 rounded-md bg-gray-100 text-gray-600">
          <MessageSquare className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
}
