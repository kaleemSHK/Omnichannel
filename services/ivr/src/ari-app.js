/**
 * BlinkOne IVR — Asterisk ARI app (Prompt 5 steps 2–3)
 */
import { createRequire } from 'node:module';
import { createLogger } from '../lib/logger.js';
import { getActiveGraph } from '../lib/flow-repo.js';
import { executeFlow } from './flow-executor.js';
import { setAriClient } from './bridge.js';

const require = createRequire(import.meta.url);
const ariClient = require('ari-client');

const log = createLogger('ivr-ari');

/** @type {Map<string, object>} */
export const callState = new Map();

const WELCOME_MEDIA = process.env.IVR_WELCOME_MEDIA || 'sound:hello-world';
const STASIS_APP = process.env.ASTERISK_ARI_APP || 'blinkone-ivr';

function setState(channelId, patch) {
  const prev = callState.get(channelId) ?? { channelId, startedAt: new Date().toISOString() };
  callState.set(channelId, { ...prev, ...patch, updatedAt: new Date().toISOString() });
}

function promisify(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

/** Fallback step-2 flow when DB graph unavailable. */
async function runWelcomeFlow(client, channel, meta) {
  const id = channel.id;
  setState(id, { ...meta, phase: 'answering' });
  await promisify(channel.answer.bind(channel));
  setState(id, { phase: 'playing', media: WELCOME_MEDIA });
  const playback = client.Playback();
  await new Promise((resolve, reject) => {
    playback.once('PlaybackFinished', () => resolve());
    playback.once('PlaybackFailed', (ev) => reject(new Error(ev?.message || 'playback failed')));
    channel.play({ media: WELCOME_MEDIA }, playback, (err) => {
      if (err) reject(err);
    });
  });
  setState(id, { phase: 'hangup' });
  await promisify(channel.hangup.bind(channel));
  setState(id, { phase: 'ended', endedAt: new Date().toISOString() });
  log.info({ channelId: id, ...meta }, 'IVR welcome flow complete');
}

function resolveTenantFromMeta(meta) {
  return meta.tenantId || process.env.IVR_DEFAULT_TENANT || 'default';
}

let ariStarted = false;

export async function startAriApp() {
  if (ariStarted) return;
  const url = (process.env.ASTERISK_ARI_URL || 'http://blinkone-asterisk:8088').replace(/\/$/, '');
  const user = process.env.ASTERISK_ARI_USER || 'blinkone';
  const pass = process.env.ASTERISK_ARI_PASSWORD || process.env.ASTERISK_ARI_PASS || 'blinkone-ari-secret';

  const client = await ariClient.connect(url, user, pass);
  setAriClient(client);
  log.info({ url, app: STASIS_APP }, 'ARI connected');

  client.on('StasisStart', async (event, channel) => {
    if (event.channel?.name?.startsWith('UnicastRTP')) return;

    const args = event.args ?? [];
    const meta = {
      direction: args[0] ?? 'unknown',
      dialed: args[1] ?? '',
      tenantId: args[2] || null,
      callerId: event.channel?.caller?.number ?? null,
      stasisArgs: args,
    };

    const id = channel.id;
    setState(id, { ...meta, phase: 'stasis_start' });
    log.info({ channelId: id, ...meta }, 'StasisStart');

    try {
      const tenantId = resolveTenantFromMeta(meta);
      const { graph, flowId, flowName } = await getActiveGraph(tenantId);
      setState(id, { tenantId, flowId, flowName });

      if (graph?.nodes?.length) {
        await executeFlow({
          client,
          channel,
          graph,
          flowId,
          meta: { ...meta, tenantId },
          setState: (patch) => setState(id, patch),
          log,
        });
        log.info({ channelId: id, flowId, flowName }, 'IVR graph flow complete');
      } else {
        await runWelcomeFlow(client, channel, meta);
      }
    } catch (err) {
      log.error({ err: err.message, channelId: id }, 'IVR flow error');
      setState(id, { phase: 'error', error: err.message });
      try {
        await promisify(channel.hangup.bind(channel));
      } catch {
        /* gone */
      }
    }
  });

  client.on('StasisEnd', (event) => {
    const cid = event.channel?.id;
    if (cid && callState.has(cid)) {
      setState(cid, { phase: 'stasis_end' });
      log.info({ channelId: cid }, 'StasisEnd');
    }
  });

  client.on('ChannelDestroyed', (event) => {
    const cid = event.channel?.id;
    if (cid) {
      setState(cid, { phase: 'destroyed', destroyedAt: new Date().toISOString() });
      setTimeout(() => callState.delete(cid), 60_000);
    }
  });

  await promisify(client.start.bind(client), STASIS_APP);
  ariStarted = true;
  log.info({ app: STASIS_APP }, 'Stasis application started');
}
