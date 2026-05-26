'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { searchContacts } from '@/lib/api/contacts';
import { TicketCustomFields, type CustomFieldValues } from '@/components/tickets/TicketCustomFields';
import { useCreateTicket, useTicketAgents } from '@/lib/hooks/useTickets';
import { isDemoDataEnabled } from '@/lib/demo/config';
import type { TicketPriorityUi, TicketTeam } from '@/lib/utils/tickets';
import type { CWContact } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NewTicketModal({ open, onClose }: Props) {
  const create = useCreateTicket();
  const { data: agents = [] } = useTicketAgents();

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriorityUi>('medium');
  const [team, setTeam] = useState<TicketTeam>('support');
  const [assigneeId, setAssigneeId] = useState('');
  const [contactQuery, setContactQuery] = useState('');
  const [contactResults, setContactResults] = useState<CWContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<CWContact | null>(null);
  const [searching, setSearching] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({});
  const [conversationId, setConversationId] = useState('');

  useEffect(() => {
    if (!open) return;
    const q = contactQuery.trim();
    if (q.length < 2) {
      setContactResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        if (isDemoDataEnabled()) {
          setContactResults([
            { id: 101, name: 'Amina Al-Rashdi', email: 'amina@example.om' } as CWContact,
            { id: 102, name: 'Mohammed Al-Saidi', email: 'mohammed@example.om' } as CWContact,
          ]);
        } else {
          const res = await searchContacts(q);
          const rows = (res as { payload?: CWContact[] }).payload ?? (res as { data?: CWContact[] }).data ?? [];
          setContactResults(Array.isArray(rows) ? rows : []);
        }
      } catch {
        setContactResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [contactQuery, open]);

  const reset = () => {
    setSubject('');
    setDescription('');
    setPriority('medium');
    setTeam('support');
    setAssigneeId('');
    setContactQuery('');
    setSelectedContact(null);
    setContactResults([]);
    setCustomFieldValues({});
    setConversationId('');
  };

  const handleSave = async () => {
    if (!subject.trim()) return;
    await create.mutateAsync({
      subject: subject.trim(),
      description: description.trim() || undefined,
      priority,
      assigneeId: assigneeId || undefined,
      contactId: selectedContact?.id,
      contactName: selectedContact?.name,
      customerEmail: selectedContact?.email,
      team,
      customFields: customFieldValues,
      conversationId: conversationId.trim() ? Number(conversationId) : undefined,
    });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} title="New ticket">
      <div className="space-y-3">
        <Field label="Subject *">
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:border-[#0B5FFF]"
          />
        </Field>

        <Field label="Contact">
          <input
            value={selectedContact ? selectedContact.name : contactQuery}
            onChange={e => {
              setSelectedContact(null);
              setContactQuery(e.target.value);
            }}
            placeholder="Search contacts…"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:border-[#0B5FFF]"
          />
          {searching && (
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Searching…
            </p>
          )}
          {!selectedContact && contactResults.length > 0 && (
            <ul className="mt-1 border border-gray-100 rounded-md max-h-32 overflow-y-auto">
              {contactResults.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedContact(c);
                      setContactQuery('');
                      setContactResults([]);
                    }}
                    className="w-full text-start px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    {c.name}
                    {c.email && <span className="text-gray-400 ms-2 text-xs">{c.email}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Assignee">
            <select
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              className="w-full px-2 py-2 text-sm border border-gray-200 rounded-md bg-white"
            >
              <option value="">Unassigned</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as TicketPriorityUi)}
              className="w-full px-2 py-2 text-sm border border-gray-200 rounded-md bg-white"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </Field>
        </div>

        <Field label="Team">
          <select
            value={team}
            onChange={e => setTeam(e.target.value as TicketTeam)}
            className="w-full px-2 py-2 text-sm border border-gray-200 rounded-md bg-white"
          >
            <option value="sales">Sales</option>
            <option value="support">Support</option>
            <option value="billing">Billing</option>
          </select>
        </Field>

        <Field label="Description">
          <textarea
            rows={4}
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:border-[#0B5FFF] resize-none"
          />
        </Field>

        <Field label="Chatwoot Conversation ID (optional)">
          <input
            type="number"
            value={conversationId}
            onChange={e => setConversationId(e.target.value)}
            placeholder="e.g. 1234 — link to an existing conversation"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:border-[#0B5FFF]"
          />
        </Field>

        <TicketCustomFields values={customFieldValues} onChange={setCustomFieldValues} />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => { reset(); onClose(); }}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-md"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!subject.trim() || create.isPending}
          onClick={() => void handleSave()}
          className="px-4 py-1.5 text-sm bg-[#0B5FFF] text-white rounded-md disabled:opacity-50 inline-flex items-center gap-2"
        >
          {create.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
          Create ticket
        </button>
      </div>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
