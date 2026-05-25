'use client';

import { useQuery } from '@tanstack/react-query';
import { listQueues } from '@/lib/api/routing';
import { DEMO_QUEUES } from '@/lib/demo/callingFixture';
import { isDemoDataEnabled, isGatewayQueryEnabled } from '@/lib/demo/config';

export function useQueues() {
  const enabled = isGatewayQueryEnabled();
  return useQuery({
    queryKey: ['queues', isDemoDataEnabled()],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_QUEUES;
      try {
        const rows = await listQueues();
        return rows.length ? rows : DEMO_QUEUES;
      } catch {
        return DEMO_QUEUES;
      }
    },
    enabled,
    refetchInterval: enabled ? 10_000 : false,
    staleTime: 5_000,
  });
}
