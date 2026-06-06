/**
 * Run published IVR graphs on Twilio PSTN (Gather/Say), matching ARI flow-executor menus.
 */
import { createLogger } from './logger.js';
import { nodeById, resolveDigitTarget } from './graph.js';
import { getActiveGraph } from './flow-repo.js';
import { requestRoute } from './routing-client.js';
import { notifyInboundCall } from './calls-notify.js';

const log = createLogger('ivr-twilio-graph');

const IVR_PUBLIC_URL = (process.env.IVR_PUBLIC_URL || 'https://app.blinksone.com/api/ivr').replace(
  /\/$/,
  '',
);
const AGENT_SIP_URI = process.env.AGENT_SIP_URI || 'sip:blinkone@204.168.137.104:5060';

/** @type {Map<string, object>} */
const graphSessions = new Map();

function xmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function respondUrl(callSid) {
  return `${IVR_PUBLIC_URL}/v1/ivr/respond/${encodeURIComponent(callSid)}`;
}

function twimlSay(text, lang = 'en-US') {
  const voice = lang.startsWith('ar') ? 'Polly.Zeina' : 'Polly.Joanna';
  return `<Say language="${xmlEscape(lang)}" voice="${voice}">${xmlEscape(text)}</Say>`;
}

function wrapResponse(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${inner}\n</Response>`;
}

function normalizeNode(node) {
  if (!node) return null;
  if (node.type === 'dtmf') {
    return {
      ...node,
      type: 'play',
      collectDigits: true,
      text: node.text || node.label,
      routes: Object.fromEntries(
        (node.options ?? []).map(o => [String(o.digit), o.next]),
      ),
    };
  }
  return node;
}

function resolveNextNode(graph, node, digit) {
  if (digit) {
    const fromRoutes = node?.routes?.[digit];
    if (fromRoutes) return nodeById(graph, fromRoutes);
    const resolved = resolveDigitTarget(graph, node.id, digit);
    if (resolved) return resolved;
    const opt = (node.options ?? []).find(o => String(o.digit) === String(digit));
    if (opt?.next) return nodeById(graph, opt.next);
  }
  if (node?.next) return nodeById(graph, node.next);
  return null;
}

async function twimlForTransfer(sess, node) {
  const queueKey = node.queue ?? node.config?.queueKey ?? 'support';
  const skillOverride = node.skillRequirements ?? node.config?.skillRequirements;
  const say = node.text || `Connecting you to ${queueKey}. Please hold.`;

  void notifyInboundCall(sess.tenantId, {
    callId: sess.callSid,
    from: sess.from,
    to: sess.to,
    transport: 'pstn',
  }).catch(e => log.warn({ err: e.message }, 'inbound notify'));

  try {
    await requestRoute({
      tenantId: sess.tenantId,
      queue: queueKey,
      callId: sess.callSid,
      callerId: sess.from,
      skillOverride: Array.isArray(skillOverride) ? skillOverride : undefined,
    });
  } catch (e) {
    log.warn({ err: e.message, queue: queueKey }, 'routing request failed');
  }

  graphSessions.delete(sess.callSid);
  return wrapResponse(
    `${twimlSay(say)}\n<Dial answerOnBridge="true" timeout="45" callerId="${xmlEscape(sess.from || '')}"><Sip>${xmlEscape(AGENT_SIP_URI)}</Sip></Dial>${twimlSay('No agents available. Goodbye.')}\n<Hangup/>`,
  );
}

async function twimlForNode(sess, rawNode) {
  const node = normalizeNode(rawNode);
  if (!node) {
    graphSessions.delete(sess.callSid);
    return wrapResponse(`${twimlSay('Goodbye.')}\n<Hangup/>`);
  }

  sess.currentNodeId = node.id;

  if (node.type === 'hangup') {
    graphSessions.delete(sess.callSid);
    return wrapResponse(`${node.text ? twimlSay(node.text) : ''}\n<Hangup/>`);
  }

  if (node.type === 'transfer' || node.type === 'enqueue') {
    return twimlForTransfer(sess, node);
  }

  if (node.type === 'voicebot') {
    graphSessions.delete(sess.callSid);
    return null;
  }

  const text = node.text || node.label || 'Please continue.';
  const collect = node.collectDigits || node.type === 'dtmf' || (node.options?.length ?? 0) > 0;

  if (collect) {
    const timeout = Math.min(Math.max(Number(node.timeoutSec) || 8, 3), 20);
    return wrapResponse(
      `<Gather numDigits="1" timeout="${timeout}" action="${xmlEscape(respondUrl(sess.callSid))}" method="POST">${twimlSay(text)}</Gather>${twimlSay('We did not receive your selection. Goodbye.')}\n<Hangup/>`,
    );
  }

  const next = node.next ? nodeById(sess.graph, node.next) : null;
  if (next) {
    sess.currentNodeId = next.id;
    return twimlForNode(sess, next);
  }

  graphSessions.delete(sess.callSid);
  return wrapResponse(`${twimlSay(text)}\n<Hangup/>`);
}

export async function tryStartGraphIvr(tenantId, callSid, from, to) {
  try {
    const { graph, flowId, flowName } = await getActiveGraph(tenantId);
    if (!graph?.nodes?.length || !graph.entry) return null;

    const sess = {
      tenantId,
      callSid,
      from,
      to,
      graph,
      flowId,
      flowName,
      currentNodeId: graph.entry,
    };
    graphSessions.set(callSid, sess);
    log.info({ callSid, flowId, flowName, entry: graph.entry }, 'twilio graph IVR start');
    return twimlForNode(sess, nodeById(graph, graph.entry));
  } catch (e) {
    log.error({ err: e.message, callSid }, 'twilio graph IVR start failed');
    return null;
  }
}

export async function continueGraphIvr(tenantId, callSid, digits) {
  const sess = graphSessions.get(callSid);
  if (!sess) return null;

  const current = nodeById(sess.graph, sess.currentNodeId);
  const digit = String(digits || '').trim().charAt(0) || '';
  const next = resolveNextNode(sess.graph, normalizeNode(current), digit);

  if (!next) {
    graphSessions.delete(callSid);
    return wrapResponse(`${twimlSay('Invalid option. Goodbye.')}\n<Hangup/>`);
  }

  log.info({ callSid, from: current?.id, digit, to: next.id }, 'twilio graph advance');
  return twimlForNode(sess, next);
}

export function hasGraphSession(callSid) {
  return graphSessions.has(callSid);
}
