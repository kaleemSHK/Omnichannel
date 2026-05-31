import type { Ticket } from '@/types';

export type TicketPriorityUi = 'high' | 'medium' | 'low';
export type TicketStatusUi = 'open' | 'pending' | 'resolved';
export type TicketTeam = 'sales' | 'support' | 'billing';

export type TicketNavView = 'all_open' | 'high_priority' | 'assigned_to_me' | 'resolved';

export interface TicketView {
  id: string;
  displayId: string;
  subject: string;
  status: TicketStatusUi;
  priority: TicketPriorityUi;
  contactId?: number;
  contactName: string;
  assigneeId?: string;
  assigneeName?: string;
  team: TicketTeam;
  slaTier: string;
  slaDeadline: string;
  inboxType: string;
  conversationId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessageView {
  id: string;
  authorName: string;
  direction: 'inbound' | 'outbound';
  content: string;
  createdAt: string;
}

const PRIORITY_MAP: Record<string, TicketPriorityUi> = {
  p1: 'high',
  p2: 'medium',
  p3: 'low',
  p4: 'low',
  urgent: 'high',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

const STATUS_MAP: Record<string, TicketStatusUi> = {
  open: 'open',
  pending: 'pending',
  'in-progress': 'pending',
  resolved: 'resolved',
  closed: 'resolved',
};

export function mapPriority(raw?: string): TicketPriorityUi {
  return PRIORITY_MAP[(raw ?? '').toLowerCase()] ?? 'medium';
}

export function mapStatus(raw?: string): TicketStatusUi {
  return STATUS_MAP[(raw ?? '').toLowerCase()] ?? 'open';
}

/** Human-readable ticket ref from DB id or demo id (handles numeric ids from API). */
export function formatTicketDisplayId(id: string | number | null | undefined): string {
  const raw = String(id ?? '');
  const digits = raw.replace(/\D/g, '').slice(-4);
  return digits ? `TKT-${digits}` : raw.slice(0, 8).toUpperCase() || 'TKT';
}

export function ticketSubject(row: { subject?: string; title?: string }): string {
  return String(row.subject ?? row.title ?? 'Untitled');
}

export function priorityToApi(p: TicketPriorityUi): Ticket['priority'] {
  if (p === 'high') return 'p1';
  if (p === 'medium') return 'p2';
  return 'p3';
}

export function isSlaBreached(deadline: string): boolean {
  return new Date(deadline).getTime() < Date.now();
}

export function formatTicketTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function filterTickets(
  tickets: TicketView[],
  opts: {
    navView: TicketNavView;
    team: TicketTeam | null;
    status: TicketStatusUi | 'all';
    priority: TicketPriorityUi | 'all';
    assigneeId?: string;
  },
): TicketView[] {
  let list = [...tickets];

  if (opts.team) list = list.filter(t => t.team === opts.team);

  if (opts.navView === 'all_open') {
    list = list.filter(t => t.status === 'open' || t.status === 'pending');
  } else if (opts.navView === 'high_priority') {
    list = list.filter(t => t.priority === 'high' && t.status !== 'resolved');
  } else if (opts.navView === 'assigned_to_me' && opts.assigneeId) {
    list = list.filter(t => t.assigneeId === opts.assigneeId);
  } else if (opts.navView === 'resolved') {
    list = list.filter(t => t.status === 'resolved');
  }

  if (opts.status !== 'all') list = list.filter(t => t.status === opts.status);
  if (opts.priority !== 'all') list = list.filter(t => t.priority === opts.priority);

  return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function countOpen(tickets: TicketView[]): number {
  return tickets.filter(t => t.status === 'open' || t.status === 'pending').length;
}

export function countHighPriority(tickets: TicketView[]): number {
  return tickets.filter(t => t.priority === 'high' && t.status !== 'resolved').length;
}
