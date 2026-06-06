'use client';

import {
  useAvailabilityStore,
  type AgentAvailability,
} from '@/lib/store/availability';
import { cn } from '@/lib/utils/cn';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const STATUS_DOT: Record<AgentAvailability, string> = {
  online: 'bg-green-500',
  busy: 'bg-amber-500',
  offline: 'bg-gray-400',
};

const STATUS_LABEL: Record<AgentAvailability, string> = {
  online: 'Online',
  busy: 'Busy',
  offline: 'Offline',
};

export function AvailabilitySelector() {
  const status = useAvailabilityStore(s => s.status);
  const setAvailabilityRemote = useAvailabilityStore(s => s.setAvailabilityRemote);
  const qc = useQueryClient();

  async function handleChange(next: AgentAvailability) {
    try {
      await setAvailabilityRemote(next);
      void qc.invalidateQueries({ queryKey: ['agents'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update availability');
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[status])} />
      <select
        value={status}
        onChange={e => void handleChange(e.target.value as AgentAvailability)}
        className="h-8 text-xs border border-gray-200 rounded-md px-2 bg-white text-gray-700 hidden sm:block"
        aria-label="Agent availability"
      >
        {(Object.keys(STATUS_LABEL) as AgentAvailability[]).map(value => (
          <option key={value} value={value}>
            {STATUS_LABEL[value]}
          </option>
        ))}
      </select>
    </div>
  );
}
