'use client';

import { useQuery } from '@tanstack/react-query';
import { listQueues } from '@/lib/api/routing';
import { isDemoDataEnabled, isGatewayQueryEnabled } from '@/lib/demo/config';

export function useQueues() {
  const live = isGatewayQueryEnabled();
  return useQuery({
    queryKey: ['queues', isDemoDataEnabled(), live],
    queryFn: async () => {
      if (isDemoDataEnabled() || !live) return [];
      try {
        return await listQueues();
      } catch {
        return [];
      }
    },
    refetchInterval: live ? 10_000 : false,
    staleTime: 5_000,
  });
}
