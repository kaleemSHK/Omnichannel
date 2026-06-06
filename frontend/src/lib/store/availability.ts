import { create } from 'zustand';
import { updateAvailability } from '@/lib/api/settings';

export type AgentAvailability = 'online' | 'busy' | 'offline';

interface AvailabilityState {
  status: AgentAvailability;
  setStatus: (status: AgentAvailability) => void;
  setAvailabilityRemote: (status: AgentAvailability) => Promise<AgentAvailability>;
}

export const useAvailabilityStore = create<AvailabilityState>((set) => ({
  status: 'offline',
  setStatus: status => set({ status }),
  setAvailabilityRemote: async status => {
    const profile = await updateAvailability(status);
    const next = profile.availability_status ?? status;
    set({ status: next });
    return next;
  },
}));

export async function markAgentOffline(): Promise<void> {
  try {
    await updateAvailability('offline');
    useAvailabilityStore.getState().setStatus('offline');
  } catch {
    useAvailabilityStore.getState().setStatus('offline');
  }
}
