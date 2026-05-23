import { cfg } from '../lib/config.mjs';

export async function run() {
  const token = cfg.callsToken;
  const routingToken = cfg.routingToken;
  const base = `http://${cfg.host || '127.0.0.1'}`;

  if (!token) return { status: 'SKIP', detail: 'CALLS_TOKEN not set' };

  const webrtc = await fetch(`${base}/api/routing/v1/agents/1/webrtc?tenant_id=1`, {
    headers: { Authorization: `Bearer ${routingToken}` },
  });
  if (!webrtc.ok) {
    return { status: 'FAIL', detail: `webrtc ${webrtc.status}` };
  }

  const calls = await fetch(`${base}/api/calls/v1/calls/incoming?tenant_id=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!calls.ok) {
    return { status: 'FAIL', detail: `calls incoming ${calls.status}` };
  }

  return { status: 'PASS', detail: 'webrtc + calls incoming reachable' };
}
