import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { getRealtimeDashboard } from './dashboards.js';

const TOKEN = (process.env.TOKEN || '').trim();
const JWT_SECRET = (process.env.JWT_SECRET || '').trim();

function b64urlToString(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}

/**
 * Verify a gateway-issued HS256 JWT without pulling in a JWT dependency.
 * The wallboard WS connects directly to this service (bypassing the gateway),
 * so the browser presents the gateway JWT — not the internal service TOKEN.
 * @returns {Record<string, unknown> | null} payload when valid, else null
 */
function verifyGatewayJwt(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${h}.${p}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(b64urlToString(p));
  } catch {
    return null;
  }
  if (payload.exp && Date.now() / 1000 > Number(payload.exp)) return null;
  return payload;
}

/**
 * @param {import('http').Server} server
 * @param {import('pino').Logger} log
 */
export function attachRealtimeWs(server, log) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', 'http://localhost');
    if (!url.pathname.endsWith('/v1/realtime')) {
      return;
    }
    // Validate Bearer token from query param or Authorization header (WS can't set headers easily).
    // Accept EITHER the internal service TOKEN (service-to-service) OR a valid gateway JWT
    // (browser clients connect here directly, bypassing the gateway, so they carry the JWT).
    const token =
      url.searchParams.get('token') ??
      (request.headers.authorization ?? '').replace(/^Bearer\s+/i, '');

    let authed = false;
    if (TOKEN && token === TOKEN) {
      authed = true;
    } else {
      const payload = verifyGatewayJwt(token, JWT_SECRET);
      if (payload) {
        authed = true;
        request.blinkoneTenantId = String(payload.tenant_id ?? payload.account_id ?? '');
      }
    }
    if (!authed) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', async (ws, request) => {
    const url = new URL(request.url || '/', 'http://localhost');
    // Prefer the tenant from the verified JWT over the (spoofable) query param.
    const tenantId = request.blinkoneTenantId || url.searchParams.get('tenant_id') || 'default';
    let closed = false;

    const push = async () => {
      if (closed || ws.readyState !== 1) return;
      try {
        const data = await getRealtimeDashboard(tenantId);
        ws.send(JSON.stringify({ type: 'realtime', data }));
      } catch (e) {
        log.warn({ err: e.message, tenantId }, 'realtime ws push failed');
      }
    };

    await push();
    const interval = setInterval(push, parseInt(process.env.REALTIME_WS_MS || '2000', 10));
    ws.on('close', () => {
      closed = true;
      clearInterval(interval);
    });
  });

  log.info('routing WebSocket /v1/realtime attached');
  return wss;
}
