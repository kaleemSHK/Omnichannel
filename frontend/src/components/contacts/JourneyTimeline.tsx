'use client';

import { useQuery } from '@tanstack/react-query';
import { Phone, MessageSquare, Mail, Globe, Clock } from 'lucide-react';
import { bnFetch } from '@/lib/api/client';

interface JourneyEvent {
  id: string;
  contactId: string;
  channel: 'voice' | 'chat' | 'email' | 'web' | 'whatsapp' | 'unknown';
  eventType: string;
  summary: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  voice: Phone,
  chat: MessageSquare,
  email: Mail,
  web: Globe,
  whatsapp: MessageSquare,
  unknown: Clock,
};

const CHANNEL_COLORS: Record<string, string> = {
  voice: 'bg-blue-100 text-blue-700',
  chat: 'bg-green-100 text-green-700',
  email: 'bg-amber-100 text-amber-700',
  web: 'bg-purple-100 text-purple-700',
  whatsapp: 'bg-emerald-100 text-emerald-700',
  unknown: 'bg-gray-100 text-gray-600',
};

async function getJourney(contactId: string): Promise<JourneyEvent[]> {
  try {
    const res = await bnFetch<{ data: JourneyEvent[] }>('tickets', `/v1/journey/${contactId}`);
    return res.data ?? [];
  } catch {
    return [];
  }
}

interface Props {
  contactId: string | number;
}

export function JourneyTimeline({ contactId }: Props) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['journey', contactId],
    queryFn: () => getJourney(String(contactId)),
    enabled: !!contactId,
  });

  if (isLoading) return <p className="text-xs text-muted-foreground p-3">Loading journey…</p>;

  if (!events.length) {
    return (
      <div className="p-4 text-center">
        <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
        <p className="text-xs text-muted-foreground">No journey events yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Customer Journey ({events.length} events)
      </h3>
      <ol className="relative border-s border-gray-200 space-y-4 ms-3">
        {events.map(ev => {
          const Icon = CHANNEL_ICONS[ev.channel] ?? Clock;
          const colorClass = CHANNEL_COLORS[ev.channel] ?? 'bg-gray-100 text-gray-600';
          return (
            <li key={ev.id} className="ms-4">
              <div className={`absolute -start-3 w-6 h-6 rounded-full flex items-center justify-center ${colorClass}`}>
                <Icon className="w-3 h-3" />
              </div>
              <p className="text-xs font-medium">{ev.eventType}</p>
              {ev.summary && <p className="text-xs text-muted-foreground">{ev.summary}</p>}
              <time className="text-[10px] text-muted-foreground">
                {new Date(ev.timestamp).toLocaleString()}
              </time>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
