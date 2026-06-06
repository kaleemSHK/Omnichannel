'use client';

import { useAgentPresence } from '@/lib/hooks/useAgentPresence';

/** Registers Chatwoot RoomChannel presence while the dashboard is open. */
export function AgentPresenceInitializer() {
  useAgentPresence();
  return null;
}
