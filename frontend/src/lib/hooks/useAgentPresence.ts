'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth';
import { useAvailabilityStore } from '@/lib/store/availability';
import { subscribeToAccountPresence } from '@/lib/api/websocket';
import { isActionCableReady } from '@/lib/env/telephony';

/**
 * Keeps Chatwoot agent presence alive (RoomChannel heartbeat + availability API).
 * Mount once inside the authenticated dashboard shell.
 */
export function useAgentPresence() {
  const user = useAuthStore(s => s.user);
  const tokens = useAuthStore(s => s.tokens);
  const hydrated = useAuthStore(s => s.hydrated);
  const setAvailabilityRemote = useAvailabilityStore(s => s.setAvailabilityRemote);
  const qc = useQueryClient();

  const accountId = user?.chatwootAccountId ?? 0;
  const userId = user?.id ?? 0;
  const ready =
    hydrated &&
    accountId > 0 &&
    userId > 0 &&
    Boolean(tokens?.pubsubToken) &&
    isActionCableReady();

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        await setAvailabilityRemote('online');
      } catch {
        /* presence heartbeat may still register online in Redis */
      }
      if (cancelled) return;

      unsubscribe = subscribeToAccountPresence(accountId, userId, () => {
        void qc.invalidateQueries({ queryKey: ['agents'] });
      });
      void qc.invalidateQueries({ queryKey: ['agents'] });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [ready, accountId, userId, setAvailabilityRemote, qc]);

  return useAvailabilityStore(s => s.status);
}
