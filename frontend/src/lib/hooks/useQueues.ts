'use client';

import { useQuery } from '@tanstack/react-query';
import { listQueues } from '@/lib/api/routing';
import { DEMO_QUEUES } from '@/lib/demo/callingFixture';
import { isDemoDataEnabled, isGatewayQueryEnabled } from '@/lib/demo/config';

export function useQueues() {
  const live = isGatewayQueryEnabled();
  return useQuery({
    queryKey: ['queues', isDemoDataEnabled(), live],
    queryFn: async () => {
      if (isDemoDataEnabled() || !live) return DEMO_QUEUES;
      try {
        const rows = await listQueues();
        return rows.length ? rows : DEMO_QUEUES;
      } catch {
        return DEMO_QUEUES;
      }
    },
    refetchInterval: live ? 10_000 : false,
    staleTime: 5_000,
  });
}
