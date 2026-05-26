'use client';

/**
 * EmailReplyForm — Sprint 2 E01
 *
 * Displayed inside TicketDetail when the ticket channel is 'Email'.
 * Lets agents compose and send email replies directly from the ticket view.
 * Also shows the full email thread history (inbound + outbound).
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Mail, Inbox, ArrowRight, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getEmailThreads,
  sendTicketEmailReply,
  type EmailThread,
} from '@/lib/api/tickets';
import type { Ticket } from '@/types';

// ─── Thread message row ───────────────────────────────────────────────────────

function ThreadRow({ thread }: { thread: EmailThread }) {
  const [expanded, setExpanded] = useState(false);
  const isInbound = thread.direction === 'inbound';
  const label = isInbound
    ? thread.fromName ? `${thread.fromName} <${thread.fromEmail}>` : (thread.fromEmail ?? 'Customer')
    : `You → ${thread.toEmail ?? 'Customer'}`;
  const preview = (thread.bodyText ?? '').trim().slice(0, 120);

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        isInbound ? 'border-gray-200 bg-white' : 'border-blue-100 bg-blue-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isInbound ? (
            <Inbox className="h-4 w-4 shrink-0 text-gray-400" />
          ) : (
            <ArrowRight className="h-4 w-4 shrink-0 text-blue-400" />
          )}
          <span className="font-medium truncate text-gray-800">{label}</span>
          {thread.subject && (
            <span className="text-gray-500 truncate hidden sm:block">— {thread.subject}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {new Date(thread.createdAt).toLocaleString()}
          </span>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-gray-400 hover:text-gray-600"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!expanded && preview && (
        <p className="mt-1 text-gray-500 text-xs truncate pl-6">{preview}</p>
      )}

      {expanded && (
        <pre className="mt-3 pl-6 whitespace-pre-wrap text-xs text-gray-700 font-mono leading-relaxed border-t border-gray-100 pt-3">
          {thread.bodyText ?? '(no body)'}
        </pre>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  ticket: Ticket;
}

export function EmailReplyForm({ ticket }: Props) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');
  const [showSubject, setShowSubject] = useState(false);

  const ticketId = String(ticket.id);

  const { data: threads = [], isLoading, refetch } = useQuery<EmailThread[]>({
    queryKey: ['email-threads', ticketId],
    queryFn: () => getEmailThreads(ticketId),
    staleTime: 30_000,
  });

  const send = useMutation({
    mutationFn: () =>
      sendTicketEmailReply(ticketId, {
        text: text.trim(),
        subject: subject.trim() || undefined,
      }),
    onSuccess: () => {
      setText('');
      setSubject('');
      qc.invalidateQueries({ queryKey: ['email-threads', ticketId] });
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
    },
  });

  const canSend = text.trim().length > 0 && !send.isPending;
  const toEmail = ticket.customerEmail ?? '';

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Mail className="h-4 w-4 text-blue-500" />
          Email Thread
          {toEmail && (
            <span className="font-normal text-gray-400 text-xs">→ {toEmail}</span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Refresh thread"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Thread history */}
      {isLoading ? (
        <div className="text-sm text-gray-400 py-4 text-center">Loading thread…</div>
      ) : threads.length === 0 ? (
        <div className="text-sm text-gray-400 py-4 text-center italic">
          No email messages yet — send the first reply below.
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
          {threads.map((t) => (
            <ThreadRow key={t.id} thread={t} />
          ))}
        </div>
      )}

      {/* Compose area */}
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Optional subject override */}
        {showSubject && (
          <div className="border-b border-gray-100 px-3 py-2 bg-gray-50">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (leave blank for auto Re: …)"
              className="w-full text-sm bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
            />
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Reply to ${toEmail || 'customer'}…`}
          rows={5}
          className="w-full px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 outline-none resize-none bg-white"
        />

        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-100">
          <button
            onClick={() => setShowSubject((s) => !s)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showSubject ? 'Hide subject' : 'Override subject'}
          </button>

          <div className="flex items-center gap-2">
            {send.isError && (
              <span className="text-xs text-red-500">
                {(send.error as Error)?.message ?? 'Send failed'}
              </span>
            )}
            {send.isSuccess && (
              <span className="text-xs text-green-600">✓ Sent</span>
            )}
            <button
              disabled={!canSend}
              onClick={() => send.mutate()}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              {send.isPending ? 'Sending…' : 'Send Email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
