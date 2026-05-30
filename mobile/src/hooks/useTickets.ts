import { useQuery } from '@tanstack/react-query';
import { listTickets } from '@/api/tickets';
import { listCustomerTickets } from '@/api/customer';
import { loadPrefs } from '@/lib/storage';

export function useTickets(contactId?: number) {
  return useQuery({
    queryKey: ['tickets', contactId],
    queryFn: async () => {
      const prefs = await loadPrefs();
      if (prefs.role === 'customer') return listCustomerTickets();
      return listTickets(contactId != null ? { contactId } : {});
    },
    staleTime: 30_000,
  });
}
