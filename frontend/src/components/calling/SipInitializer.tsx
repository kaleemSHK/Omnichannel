'use client';

/**
 * Mounts useJsSip() once at the dashboard level so the SIP UA is
 * initialised regardless of which page the agent opens first.
 */
import { useJsSip } from '@/lib/hooks/useJsSip';
import { useRoutingPresence } from '@/lib/hooks/useRoutingPresence';

export function SipInitializer() {
  useRoutingPresence();
  useJsSip();
  return null;
}
