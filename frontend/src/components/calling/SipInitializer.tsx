'use client';

/**
 * Mounts useJsSip() once at the dashboard level so the SIP UA is
 * initialised regardless of which page the agent opens first.
 */
import { useJsSip } from '@/lib/hooks/useJsSip';

export function SipInitializer() {
  useJsSip();
  return null;
}
