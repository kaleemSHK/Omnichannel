/**
 * Execute versioned IVR graph over ARI (Prompt 5 step 3).
 */
import { nodeById, resolveDigitTarget } from '../lib/graph.js';
import { requestRoute } from '../lib/routing-client.js';

function promisify(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

async function playMedia(client, channel, media, log) {
  const playback = client.Playback();
  await new Promise((resolve, reject) => {
    playback.once('PlaybackFinished', () => resolve());
    playback.once('PlaybackFailed', (ev) => reject(new Error(ev?.message || 'playback failed')));
    channel.play({ media }, playback, (err) => {
      if (err) reject(err);
    });
  });
  log?.debug?.({ media }, 'playback finished');
}

/**
 * @param {object} opts
 * @param {import('ari-client').Client} opts.client
 * @param {object} opts.channel
 * @param {object} opts.graph
 * @param {string} opts.flowId
 * @param {function} opts.setState
 * @param {object} opts.log
 */
export async function executeFlow({ client, channel, graph, flowId, setState, log, meta = {} }) {
  let node = nodeById(graph, graph.entry);
  if (!node) throw new Error(`entry node "${graph.entry}" missing`);

  setState({ flowId, currentNode: node.id, phase: 'executing' });

  if (!channel.state || channel.state === 'Ring') {
    await promisify(channel.answer.bind(channel));
    setState({ phase: 'answered' });
  }

  const maxSteps = 64;
  for (let step = 0; step < maxSteps && node; step += 1) {
    setState({ currentNode: node.id, nodeType: node.type, step });

    switch (node.type) {
      case 'play': {
        const media = node.media || (node.text ? `sound:${node.text}` : null);
        if (!media) throw new Error(`play node "${node.id}" needs media or text`);
        setState({ phase: 'playing', media });
        await playMedia(client, channel, media, log);
        if (node.collectDigits) {
          setState({ phase: 'collecting', timeoutSec: node.timeoutSec ?? 5 });
          const digit = await collectDigit(channel, node, setState);
          const next = resolveDigitTarget(graph, node.id, digit) || (node.next ? nodeById(graph, node.next) : null);
          if (!next) {
            log.info({ digit, from: node.id }, 'no route for digit — hangup');
            await promisify(channel.hangup.bind(channel));
            setState({ phase: 'ended', reason: 'no_route' });
            return;
          }
          node = next;
          break;
        }
        node = node.next ? nodeById(graph, node.next) : null;
        break;
      }
      case 'enqueue': {
        const queueKey = node.queue ?? 'default';
        setState({ phase: 'enqueue', queue: queueKey });
        try {
          const route = await requestRoute({
            tenantId: meta.tenantId || 'default',
            queue: queueKey,
            callId: channel.id,
            callerId: meta.callerId,
            priority: node.priority ?? 0,
          });
          setState({ phase: route.status, routing: route });
          if (route.status === 'assigned') {
            log.info({ queue: queueKey, agentId: route.agentId }, 'call assigned to agent');
            const connectMedia = node.connectMedia || 'sound:beep';
            await playMedia(client, channel, connectMedia, log);
            setState({ phase: 'bridged', agentId: route.agentId });
            return;
          }
          log.info({ queue: queueKey, position: route.position }, 'call queued');
          const holdMedia = node.holdMedia || process.env.IVR_HOLD_MEDIA || 'sound:please-hold';
          setState({ phase: 'holding', media: holdMedia });
          await playMedia(client, channel, holdMedia, log);
          setState({ phase: 'waiting_for_agent' });
          return;
        } catch (err) {
          log.error({ err: err.message, queue: queueKey }, 'routing handoff failed');
          setState({ phase: 'enqueue_failed', error: err.message });
          await promisify(channel.hangup.bind(channel));
          setState({ phase: 'ended', reason: 'routing_error' });
          return;
        }
      }
      case 'hangup':
        setState({ phase: 'hangup' });
        await promisify(channel.hangup.bind(channel));
        setState({ phase: 'ended', endedAt: new Date().toISOString() });
        return;
      default:
        throw new Error(`unsupported node type: ${node.type}`);
    }
  }

  if (node) throw new Error('IVR graph exceeded max steps');
  setState({ phase: 'ended', reason: 'completed' });
}

function collectDigit(channel, node, setState) {
  const timeoutMs = (node.timeoutSec ?? 5) * 1000;
  return new Promise((resolve) => {
    let done = false;
    const finish = (digit) => {
      if (done) return;
      done = true;
      channel.removeListener('ChannelDtmfReceived', onDtmf);
      clearTimeout(timer);
      setState({ phase: 'digit_collected', digit });
      resolve(digit);
    };
    const onDtmf = (ev) => {
      const d = ev.digit ?? ev.digit_received;
      if (d != null) finish(String(d));
    };
    channel.on('ChannelDtmfReceived', onDtmf);
    const timer = setTimeout(() => finish(node.defaultDigit ?? ''), timeoutMs);
  });
}
