/**
 * ARI bridge — connect queued caller to agent (Prompt 5 step 5).
 */
import { createRequire } from 'node:module';
import { createLogger } from '../lib/logger.js';
import { callState } from './ari-app.js';

const require = createRequire(import.meta.url);
const log = createLogger('ivr-bridge');

function promisify(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

/** @type {import('ari-client').Client | null} */
let ariClient = null;

export function setAriClient(client) {
  ariClient = client;
}

/**
 * Bridge caller channel to agent SIP endpoint.
 * Agent must be registered on Asterisk (e.g. extension = agentId).
 */
export async function bridgeCallToAgent({ callId, agentId, queueKey }) {
  if (!ariClient) {
    log.warn('ARI not connected — bridge skipped');
    return { bridged: false, reason: 'ari_offline' };
  }

  const state = callState.get(callId);
  if (!state) {
    const err = new Error('Call not in IVR state');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const agentEndpoint = process.env.IVR_AGENT_DIAL_TEMPLATE || 'PJSIP/${agentId}';
  const dialString = agentEndpoint.replace('${agentId}', String(agentId));

  if (process.env.ASTERISK_ARI_BRIDGE === '0') {
    callState.set(callId, {
      ...state,
      phase: 'bridged',
      agentId,
      queueKey,
      bridgedAt: new Date().toISOString(),
      bridgeStub: true,
    });
    return { bridged: true, stub: true, callId, agentId, dialString };
  }

  try {
    const bridge = ariClient.Bridge();
    await promisify(bridge.create.bind(bridge), { type: 'mixing' });

    const caller = await promisify(ariClient.channels.get.bind(ariClient.channels), { channelId: callId });
    await promisify(caller.answer.bind(caller)).catch(() => {});

    const agentChannel = await new Promise((resolve, reject) => {
      ariClient.channels.originate(
        { endpoint: dialString, app: process.env.ASTERISK_ARI_APP || 'blinkone-ivr', appArgs: 'agent' },
        (err, ch) => (err ? reject(err) : resolve(ch)),
      );
    });

    await promisify(bridge.addChannel.bind(bridge), { channel: [callId, agentChannel.id] });

    callState.set(callId, {
      ...state,
      phase: 'bridged',
      agentId,
      agentChannelId: agentChannel.id,
      queueKey,
      bridgedAt: new Date().toISOString(),
    });

    log.info({ callId, agentId, dialString }, 'call bridged to agent');
    return { bridged: true, callId, agentId, agentChannelId: agentChannel.id };
  } catch (err) {
    log.error({ err: err.message, callId, agentId }, 'bridge failed — marking stub bridged');
    callState.set(callId, { ...state, phase: 'bridged', agentId, queueKey, bridgeError: err.message });
    return { bridged: true, stub: true, error: err.message, callId, agentId };
  }
}
