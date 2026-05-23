import { WebSocketServer } from 'ws';
import { getRealtimeDashboard } from './dashboards.js';

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
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', async (ws, request) => {
    const url = new URL(request.url || '/', 'http://localhost');
    const tenantId = url.searchParams.get('tenant_id') || 'default';
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
