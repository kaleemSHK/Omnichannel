/**
 * Supervisor ChanSpy via ARI (stub + optional live).
 */
import { createLogger } from '../lib/logger.js';
import { callState } from './ari-app.js';

const log = createLogger('ivr-supervise');

export async function applySuperviseMode({ callId, mode, supervisorId }) {
  const state = callState.get(callId);
  if (!state) {
    const err = new Error('Call not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const spyMap = { listen: 'q', whisper: 'w', barge: 'B' };
  const spy = spyMap[mode] || 'q';

  callState.set(callId, {
    ...state,
    supervise: { mode, supervisorId, spy, at: new Date().toISOString() },
  });

  log.info({ callId, mode, supervisorId, spy }, 'supervisor mode set (ChanSpy via dialplan in prod)');

  return {
    callId,
    mode,
    supervisorId,
    chanSpyOptions: spy,
    note: 'Production: originate supervisor channel with ChanSpy',
  };
}
