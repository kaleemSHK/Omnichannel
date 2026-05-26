'use client';

/**
 * SlaAlertsProvider — mounts the useSlaBreachAlerts hook app-wide
 * so breach toast notifications fire regardless of which page is open.
 * Renders no DOM; purely a side-effect host.
 */

import { useSlaBreachAlerts } from '@/lib/hooks/useSla';

export function SlaAlertsProvider({ children }: { children: React.ReactNode }) {
  useSlaBreachAlerts();
  return <>{children}</>;
}
