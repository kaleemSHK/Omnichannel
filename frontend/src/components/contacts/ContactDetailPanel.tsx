'use client';

import Link from 'next/link';
import { Loader2, MessageSquare, Pencil, Phone, User } from 'lucide-react';
import {
  contactAvatarClass,
  contactInitials,
  contactPlan,
  contactSlaTier,
  formatRelativeDate,
  slaTierBadgeClass,
  ticketDisplayId,
  ticketPriorityClass,
} from '@/lib/utils/contacts';
import { useContact, useContactConversations, useContactTickets } from '@/lib/hooks/useContacts';
import { useJsSip } from '@/lib/hooks/useJsSip';
import { useAuthStore } from '@/lib/store/auth';
import { cn } from '@/lib/utils/cn';
import type { CWContact } from '@/types';

interface Props {
  contactId: number | null;
  onEdit: (contact: CWContact) => void;
}

export function ContactDetailPanel({ contactId, onEdit }: Props) {
  const { data: contact, isLoading } = useContact(contactId);
  const { data: conversations = [] } = useContactConversations(contactId);
  const { data: tickets = [] } = useContactTickets(contactId);
  const { makeCall } = useJsSip();
  const accountId = useAuthStore(s => s.user?.chatwootAccountId);

  if (!contactId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 h-full">
        <User className="w-10 h-10 opacity-40" />
        <p className="text-sm">Select a contact</p>
      </div>
    );
  }

  if (isLoading || !contact) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-muted-foreground" size={28} />
      </div>
    );
  }

  const tier = contactSlaTier(contact);
  const phone = contact.phone_number?.replace(/\D/g, '') ?? '';

  return (
    <div className="flex-1 overflow-y-auto p-6 h-full">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'size-12 rounded-full flex items-center justify-center text-lg font-medium shrink-0',
            contactAvatarClass(contact.name),
          )}
        >
          {contactInitials(contact.name)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold">{contact.name}</h1>
          {contact.company?.name && (
            <p className="text-sm text-muted-foreground">{contact.company.name}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            className="p-2 rounded-lg border border-gray-200 hover:bg-muted"
            title="Edit"
            onClick={() => onEdit(contact)}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="p-2 rounded-lg border border-gray-200 hover:bg-muted disabled:opacity-50"
            title="Call"
            disabled={!phone}
            onClick={() => phone && makeCall(phone)}
          >
            <Phone size={16} className="text-brand-primary" />
          </button>
          <Link
            href={`/conversations?contact_id=${contact.id}`}
            className="p-2 rounded-lg border border-gray-200 hover:bg-muted"
            title="Message"
          >
            <MessageSquare size={16} className="text-brand-primary" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-6 text-sm">
        <Info label="Phone" value={contact.phone_number ?? '—'} />
        <Info label="Email" value={contact.email ?? '—'} />
        <Info label="Account ID" value={accountId ? String(accountId) : '—'} />
        <div>
          <p className="text-xs text-muted-foreground">SLA tier</p>
          <span
            className={`inline-flex mt-0.5 px-2 py-0.5 rounded-full text-xs capitalize ${slaTierBadgeClass(tier)}`}
          >
            {tier}
          </span>
        </div>
        <Info label="Plan" value={contactPlan(contact)} />
        <Info label="Location" value={contact.location ?? '—'} />
        <Info label="Created" value={formatRelativeDate(contact.created_at)} />
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium">Recent conversations</h2>
          <Link href={`/conversations?contact_id=${contact.id}`} className="text-xs text-brand-primary hover:underline">
            View all
          </Link>
        </div>
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground">No conversations</p>
        )}
        {conversations.slice(0, 5).map(c => (
          <Link
            key={c.id}
            href={`/conversations?contact_id=${contact.id}`}
            className="block py-2 border-b border-gray-50 last:border-0 hover:bg-muted/50 rounded px-1"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-medium capitalize',
                  c.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700',
                )}
              >
                {c.status ?? 'open'}
              </span>
              {c.last_activity_at != null && (
                <span className="text-xs text-muted-foreground ms-auto">
                  {formatRelativeDate(c.last_activity_at)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {c.messages?.[0]?.content?.replace(/\s+/g, ' ') ?? 'No preview'}
            </p>
          </Link>
        ))}
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium">Open tickets</h2>
          <Link href={`/tickets?contact_id=${contact.id}`} className="text-xs text-brand-primary hover:underline">
            View all
          </Link>
        </div>
        {tickets.length === 0 && (
          <p className="text-xs text-muted-foreground">No open tickets</p>
        )}
        {tickets.slice(0, 5).map(t => (
          <Link
            key={t.id}
            href={`/tickets?contact_id=${contact.id}`}
            className="py-2 border-b border-gray-50 last:border-0 flex gap-2 items-center hover:bg-muted/50 rounded px-1"
          >
            <span className="text-xs font-mono text-muted-foreground shrink-0">
              #{ticketDisplayId(t.id)}
            </span>
            <span className="text-sm flex-1 truncate">{t.subject}</span>
            <span
              className={cn(
                'text-[10px] uppercase px-1.5 py-0.5 rounded shrink-0',
                ticketPriorityClass(t.priority),
              )}
            >
              {t.priority}
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-all">{value}</p>
    </div>
  );
}
