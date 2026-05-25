'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, MessageSquare, Pencil, Phone, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import {
  contactAvatarClass,
  contactDisplayName,
  contactInitials,
  contactPlan,
  contactSlaTier,
  formatRelativeDate,
  slaTierBadgeClass,
  ticketDisplayId,
  ticketPriorityClass,
} from '@/lib/utils/contacts';
import { conversationSnippet } from '@/lib/utils/conversations';
import {
  useContact,
  useContactConversations,
  useContactTickets,
  useDeleteContact,
} from '@/lib/hooks/useContacts';
import { useCallsStore } from '@/lib/store/calls';
import { useAuthStore } from '@/lib/store/auth';
import { can } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { CWContact, CWConversation } from '@/types';

interface Props {
  contactId: number | null;
  onEdit: (contact: CWContact) => void;
}

export function ContactDetailPanel({ contactId, onEdit }: Props) {
  const { data: contact, isLoading } = useContact(contactId);
  const { data: conversations = [] } = useContactConversations(contactId);
  const { data: tickets = [] } = useContactTickets(contactId);
  const makeCall = useCallsStore(s => s.makeCall);
  const sipRegistered = useCallsStore(s => s.sipRegistered);
  const role = useAuthStore(s => s.user?.role);
  const deleteMutation = useDeleteContact();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

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
  const displayName = contactDisplayName(contact);
  const phone = contact.phone_number?.replace(/[^\d+]/g, '') ?? '';
  const latestConversationId = conversations[0]?.id;
  const viewAllHref = latestConversationId
    ? `/conversations?conversation_id=${latestConversationId}`
    : '/conversations';

  function handleCallContact() {
    if (!phone) return;
    if (!makeCall || !sipRegistered) {
      toast.error('SIP not connected — visit the Calling page to register your phone first.');
      return;
    }
    makeCall(phone);
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-6 h-full">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'size-12 rounded-full flex items-center justify-center text-lg font-medium shrink-0',
              contactAvatarClass(displayName),
            )}
          >
            {contactInitials(displayName)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold">{displayName}</h1>
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
              title={sipRegistered ? 'Call' : 'SIP not connected'}
              disabled={!phone}
              onClick={handleCallContact}
              aria-label={`Call ${displayName}`}
            >
              <Phone size={16} className={sipRegistered ? 'text-brand-primary' : 'text-muted-foreground'} />
            </button>
            <Link
              href="/conversations"
              className="p-2 rounded-lg border border-gray-200 hover:bg-muted"
              title="Open conversations"
            >
              <MessageSquare size={16} className="text-brand-primary" />
            </Link>
            {can(role, 'manageTeam') && (
              <button
                type="button"
                className="p-2 rounded-lg border border-red-200 hover:bg-red-50 disabled:opacity-50"
                title="Delete contact"
                disabled={deleteMutation.isPending}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={16} className="text-red-500" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-6 text-sm">
          <Info label="Phone" value={contact.phone_number ?? '—'} />
          <Info label="Email" value={contact.email ?? '—'} />
          <Info label="Contact ID" value={String(contact.id)} />
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
            <Link href={viewAllHref} className="text-xs text-brand-primary hover:underline">
              View all
            </Link>
          </div>
          {conversations.length === 0 && (
            <p className="text-xs text-muted-foreground">No conversations</p>
          )}
          {conversations.slice(0, 5).map(c => (
            <Link
              key={c.id}
              href={`/conversations?conversation_id=${c.id}`}
              className="block py-2 border-b border-gray-50 last:border-0 hover:bg-muted/50 rounded px-1"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-medium capitalize',
                    c.status === 'resolved'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700',
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
                {conversationSnippet(c as CWConversation) || 'No preview'}
              </p>
            </Link>
          ))}
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium">Open tickets</h2>
            <Link
              href={`/tickets?contact_id=${contact.id}`}
              className="text-xs text-brand-primary hover:underline"
            >
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

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-80 shadow-xl">
            <h3 className="font-semibold text-base mb-2">Delete contact?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This will permanently delete <strong>{displayName}</strong> and cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-red-200 text-red-600 hover:bg-red-50"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  deleteMutation.mutate(contact.id, {
                    onSuccess: () => {
                      setConfirmDelete(false);
                      router.push('/contacts');
                    },
                    onError: err => {
                      toast.error(err instanceof Error ? err.message : 'Delete failed');
                      setConfirmDelete(false);
                    },
                  });
                }}
              >
                {deleteMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin me-1" />
                ) : (
                  <Trash2 size={14} className="me-1" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
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
