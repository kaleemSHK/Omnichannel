import { hangupCall, endCall } from '@/lib/api/calls';
import { completeRoute } from '@/lib/api/routing';
import { isDemoDataEnabled, shouldSkipGatewayFetch } from '@/lib/demo/config';
import type { CallSession } from '@/types';

/** Sync CDR + routing when a call leg ends (local or remote hangup). */
export async function syncCallTeardown(
  activeCall: CallSession | null,
  opts?: { agentId?: string; outcome?: 'completed' | 'declined' },
): Promise<void> {
  if (!activeCall || isDemoDataEnabled() || shouldSkipGatewayFetch()) return;

  const id = activeCall.id;
  const roomId = activeCall.roomId?.trim();
  const metaExt = (activeCall.metadata as { externalCallId?: string } | undefined)?.externalCallId?.trim();
  // Prefer routing/mobile call id (room_id) over Postgres session uuid for ACD complete.
  const routeId =
    metaExt ||
    (roomId && roomId !== id ? roomId : null) ||
    id;
  const outcome = opts?.outcome ?? 'completed';

  if (opts?.agentId && routeId) {
    try {
      await completeRoute({
        callId: routeId,
        agentId: opts.agentId,
        disposition: outcome === 'declined' ? 'declined' : 'completed',
      });
    } catch {
      /* best-effort */
    }
  }

  try {
    await hangupCall(id, roomId);
  } catch {
    try {
      await endCall(id, outcome, roomId);
    } catch {
      /* SIP may have ended without a DB row */
    }
  }
}
