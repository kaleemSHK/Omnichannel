import { useQuery } from '@tanstack/react-query';
import { listTickets } from '@/api/tickets';

export function useTickets(contactId?: number) {
  return useQuery({
    queryKey: ['tickets', contactId],
    queryFn: () => listTickets(contactId != null ? { contactId } : {}),
    staleTime: 30_000,
  });
}
