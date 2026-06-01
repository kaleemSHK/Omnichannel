'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Loader2,
  MessageSquare,
  Pencil,
  Phone,
  Trash2,
  User,
  Mail,
  MapPin,
  Building2,
  Copy,
  Check,
  Hash,
  Calendar,
  Plus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Ticket,
} from 'lucide-react';
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

// ─── Label colour ───────────────────────────────────────────────────────────────

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

// ─── Copy button ────────────────────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy ${label ?? value}`}
      className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ─── Info row ───────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  copyable = false,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  copyable?: boolean;
  href?: string;
}) {
  if (!value || value === '—') return null;
  return (
    <div className="flex items-center gap-2.5 py-2 group">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        {href ? (
          <a href={href} className="text-sm text-brand-primary hover:underline truncate block">{value}</a>
        ) : (
          <p className="text-sm text-gray-900 truncate">{value}</p>
        )}
      </div>
      {copyable && <CopyButton value={value} label={label} />}
    </div>
  );
}

// ─── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-center flex-1">
      <p className="text-lg font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Collapsible section ────────────────────────────────────────────────────────

function Section({
  title,
  count,
  action,
  children,
  defaultOpen = true,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-gray-100 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-brand-primary transition-colors"
        >
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {title}
          {count !== undefined && count > 0 && (
            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">
              {count}
            </span>
          )}
        </button>
        {action}
      </div>
      {open && children}
    </div>
  );
}

// ─── Status badge ───────────────────────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  open:     'bg-blue-100 text-blue-700',
  pending:  'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  snoozed:  'bg-purple-100 text-purple-700',
};

// ─── Empty state ────────────────────────────────────────────────────────────────

function NoSelection() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 h-full bg-gray-50/30">
      <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
        <User className="w-7 h-7 text-gray-300" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">No contact selected</p>
        <p className="text-xs text-muted-foreground mt-0.5">Pick one from the list or create a new one</p>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

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

  if (!contactId) return <NoSelection />;

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
  const plan = contactPlan(contact);
  const labels = (contact.labels ?? []).filter(l =>
    !['gold', 'silver', 'bronze', 'vip', 'enterprise', 'professional', 'standard'].includes(l.toLowerCase()),
  );
  const openConversations = conversations.filter(c => c.status !== 'resolved');
  const openTickets = tickets.filter(t => t.status !== 'resolved');
  const latestConv = conversations[0];

  function handleCallContact() {
    if (!phone) return;
    if (!makeCall || !sipRegistered) {
      toast.error('SIP not connected — visit the Calling page first.');
      return;
    }
    makeCall(phone);
  }

  return (
    <>
      <div className="h-full overflow-y-auto">
        {/* ── Hero ── */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className={cn(
              'size-14 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0 shadow-sm',
              contactAvatarClass(displayName),
            )}>
              {contactInitials(displayName)}
            </div>

            {/* Name + company + tier */}
            <div className="flex-1 min-w-0 pt-0.5">
              <h1 className="text-lg font-bold text-gray-900 leading-tight truncate">{displayName}</h1>
              {contact.company?.name && (
                <p className="text-sm text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                  <Building2 className="w-3 h-3 shrink-0" />
                  {contact.company.name}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize',
                  slaTierBadgeClass(tier),
                )}>
                  {tier}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700">
                  {plan}
                </span>
                {labels.slice(0, 2).map(l => (
                  <span key={l} className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium', labelColor(l))}>
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              disabled={!phone}
              onClick={handleCallContact}
              title={sipRegistered ? `Call ${phone}` : 'SIP not connected'}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border transition-colors',
                phone && sipRegistered
                  ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'border-gray-200 text-gray-400 cursor-not-allowed',
              )}
            >
              <Phone className="w-3.5 h-3.5" />
              Call
            </button>
            {latestConv ? (
              <Link
                href={`/conversations?conversation_id=${latestConv.id}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Message
              </Link>
            ) : (
              <Link
                href="/conversations"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Message
              </Link>
            )}
            <button
              type="button"
              onClick={() => onEdit(contact)}
              title="Edit"
              className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {can(role, 'manageTeam') && (
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => setConfirmDelete(true)}
                title="Delete"
                className="px-3 py-2 text-xs font-medium rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex gap-2">
            <StatCard label="Conversations" value={conversations.length} sub={openConversations.length > 0 ? `${openConversations.length} open` : 'none open'} />
            <StatCard label="Tickets" value={tickets.length} sub={openTickets.length > 0 ? `${openTickets.length} open` : 'none open'} />
            <StatCard label="Since" value={new Date(contact.created_at).getFullYear().toString()} sub={formatRelativeDate(contact.created_at)} />
          </div>
        </div>

        {/* ── Contact info ── */}
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Contact info</p>
          <div className="divide-y divide-gray-50">
            <InfoRow icon={Phone}    label="Phone"    value={contact.phone_number ?? '—'} copyable href={contact.phone_number ? `tel:${contact.phone_number}` : undefined} />
            <InfoRow icon={Mail}     label="Email"    value={contact.email ?? '—'}        copyable href={contact.email ? `mailto:${contact.email}` : undefined} />
            <InfoRow icon={MapPin}   label="Location" value={contact.location ?? '—'}     copyable={false} />
            <InfoRow icon={Hash}     label="ID"       value={String(contact.id)}          copyable />
            <InfoRow icon={Calendar} label="Created"  value={formatRelativeDate(contact.created_at)} />
          </div>
        </div>

        {/* ── Body sections ── */}
        <div className="px-6 pb-8">
          {/* Recent conversations */}
          <Section
            title="Conversations"
            count={conversations.length}
            action={
              <Link
                href={latestConv ? `/conversations?conversation_id=${latestConv.id}` : '/conversations'}
                className="text-xs text-brand-primary hover:underline flex items-center gap-1"
              >
                View all <ExternalLink className="w-3 h-3" />
              </Link>
            }
          >
            {conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No conversations yet</p>
            ) : (
              <div className="space-y-1">
                {conversations.slice(0, 5).map(c => {
                  const snippet = conversationSnippet(c as CWConversation);
                  const status = c.status ?? 'open';
                  return (
                    <Link
                      key={c.id}
                      href={`/conversations?conversation_id=${c.id}`}
                      className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize', STATUS_CLS[status] ?? 'bg-gray-100 text-gray-600')}>
                            {status}
                          </span>
                          <span className="text-[10px] text-muted-foreground ms-auto">
                            {c.last_activity_at != null ? formatRelativeDate(c.last_activity_at) : ''}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {snippet || '#' + c.id}
                        </p>
                      </div>
                      <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-brand-primary shrink-0 mt-1 transition-colors" />
                    </Link>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Open tickets */}
          <Section
            title="Tickets"
            count={tickets.length}
            action={
              <Link
                href={`/tickets?contact_id=${contact.id}`}
                className="text-xs text-brand-primary hover:underline flex items-center gap-1"
              >
                View all <ExternalLink className="w-3 h-3" />
              </Link>
            }
          >
            {tickets.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No tickets yet</p>
            ) : (
              <div className="space-y-1">
                {tickets.slice(0, 5).map(t => (
                  <Link
                    key={t.id}
                    href={`/tickets?contact_id=${contact.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <Ticket className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-mono text-muted-foreground shrink-0">#{ticketDisplayId(t.id)}</span>
                    <span className="text-xs text-gray-800 flex-1 truncate">{t.subject}</span>
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0', ticketPriorityClass(t.priority))}>
                      {t.priority}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* Notes section */}
          <Section title="Notes" defaultOpen={false}>
            <textarea
              placeholder="Add a note about this contact…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-brand-primary h-20 bg-gray-50"
            />
            <Button
              type="button"
              size="sm"
              className="mt-2 bg-brand-primary hover:bg-brand-primary/90 text-xs h-7"
            >
              <Plus className="w-3 h-3 me-1" />
              Save note
            </Button>
          </Section>
        </div>
      </div>

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="font-semibold text-base mb-1">Delete contact?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              <strong>{displayName}</strong> will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  deleteMutation.mutate(contact.id, {
                    onSuccess: () => { setConfirmDelete(false); router.push('/contacts'); },
                    onError: err => { toast.error(err instanceof Error ? err.message : 'Delete failed'); setConfirmDelete(false); },
                  });
                }}
              >
                {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
