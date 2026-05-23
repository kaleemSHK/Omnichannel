import { getCallMeta } from './call-meta.js';
import { listAgentStates } from './redis-state.js';
import { notifySupervise } from './ari-notify.js';

/** @type {Map<string, object>} */
const sessions = new Map();

export async function listSuperviseSessions(tenantId) {
  const agents = await listAgentStates(tenantId);
  const active = agents.filter((a) => a.status === 'busy' && a.currentCallId);
  return active.map((a) => ({
    callId: a.currentCallId,
    agentId: a.agentId,
    tenantId,
  }));
}

export async function superviseSetMode(tenantId, callId, { mode, supervisorId, supervisorTenantId }) {
  const meta = await getCallMeta(tenantId, callId);
  if (!meta?.agentId) {
    const err = new Error('Call not active or not assigned');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (supervisorTenantId && String(supervisorTenantId) !== String(tenantId)) {
    const err = new Error('Supervisor tenant mismatch');
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (meta.tenantId && String(meta.tenantId) !== String(tenantId)) {
    const err = new Error('Call belongs to another tenant');
    err.code = 'FORBIDDEN';
    throw err;
  }

  const sessionKey = `${tenantId}:${callId}`;
  const row = {
    callId,
    tenantId,
    agentId: meta.agentId,
    mode,
    supervisorId: supervisorId ?? 'unknown',
    startedAt: new Date().toISOString(),
  };
  sessions.set(sessionKey, row);

  const ari = await notifySupervise({ tenantId, callId, mode, supervisorId, agentChannelId: meta.agentChannelId });
  return { ...row, ari };
}
