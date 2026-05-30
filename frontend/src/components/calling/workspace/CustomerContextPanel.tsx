'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  Clock,
  MessageSquare,
  Ticket,
  User,
} from 'lucide-react';
import { listTickets } from '@/lib/api/tickets';
import { lookupContactAll } from '@/lib/api/connectors';
import { cn } from '@/lib/utils/cn';
import type { ActiveCall } from '@/lib/store/calls';

export function CustomerContextPanel({
  call,
  contactPhone,
  contactName,
  collapsed,
  onToggle,
}: {
  call?: ActiveCall | null;
  contactPhone?: string;
  contactName?: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const phone = (call?.customerPhone ?? contactPhone ?? '').trim();

  const { data: crm } = useQuery({
    queryKey: ['crm-lookup', phone],
    queryFn: () => lookupContactAll(phone),
    enabled: phone.length >= 6,
    staleTime: 60_000,
  });

  const { data: ticketsRes } = useQuery({
    queryKey: ['tickets-by-phone', phone],
    queryFn: () => listTickets({ status: 'open' }),
    enabled: !!(call || phone),
    staleTime: 30_000,
  });

  const tickets = (ticketsRes?.data ?? []).slice(0, 4);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="w-10 shrink-0 border-s border-white/10 bg-slate-950/80 flex flex-col items-center py-4 gap-3 text-slate-400 hover:text-white transition-colors"
        aria-label="Expand customer panel"
      >
        <User size={18} />
        <ChevronRight size={16} className="rotate-180" />
      </button>
    );
  }

  return (
    <aside className="w-80 shrink-0 border-s border-white/10 bg-slate-950/60 flex flex-col min-h-0 animate-cw-slide-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-white">
          <User size={16} className="text-sky-400" />
          <span className="text-sm font-semibold">Customer intelligence</span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-slate-500 hover:text-white p-1 rounded"
          aria-label="Collapse panel"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {!call ? (
          <p className="text-sm text-slate-500">Select or answer a call to load context.</p>
        ) : (
          <>
            <div className="cw-glass rounded-xl p-4 space-y-2">
              <p className="text-lg font-semibold text-white truncate">
                {crm?.name ?? contactName ?? call?.customerPhone ?? phone}
              </p>
              <p className="text-xs text-slate-400">{phone}</p>
              {crm?.email && <p className="text-xs text-slate-500">{crm.email}</p>}
              <div className="flex flex-wrap gap-1.5 pt-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/20">
                  Voice
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20">
                  SLA on track
                </span>
              </div>
            </div>

            <section>
              <div className="flex items-center gap-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <Ticket size={12} />
                Open tickets
              </div>
              {tickets.length === 0 ? (
                <p className="text-xs text-slate-500">No open tickets</p>
              ) : (
                <ul className="space-y-2">
                  {tickets.map(t => (
                    <li key={t.id}>
                      <Link
                        href={`/tickets?id=${t.id}`}
                        className="block cw-glass rounded-lg px-3 py-2 hover:border-sky-500/30 transition-colors"
                      >
                        <p className="text-xs font-medium text-white truncate">{t.title}</p>
                        <p className="text-[10px] text-slate-500 capitalize">{t.status}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <Clock size={12} />
                Timeline
              </div>
              <div className="relative ps-3 border-s border-white/10 space-y-3">
                <div className="absolute start-0 top-1 bottom-1 w-px bg-gradient-to-b from-sky-500/50 to-transparent" />
                <div className="text-xs text-slate-400">
                  <span className="text-slate-300 font-medium">Now</span> — Active voice session
                </div>
                {crm?.source && (
                  <div className="text-xs text-slate-500">CRM: {crm.source}</div>
                )}
              </div>
            </section>

            <div className="flex gap-2">
              <Link
                href="/contacts"
                className="flex-1 text-center text-xs py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
              >
                Open CRM
              </Link>
              <Link
                href="/conversations"
                className="flex-1 text-center text-xs py-2 rounded-lg bg-sky-600/80 text-white hover:bg-sky-500 transition-colors flex items-center justify-center gap-1"
              >
                <MessageSquare size={12} />
                Chat
              </Link>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
