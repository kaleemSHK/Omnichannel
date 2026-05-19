import { randomUUID } from 'node:crypto';
import { AppError } from './errors.js';

export const ok   = (res, data, status = 200) => res.status(status).json({ data });
export const fail = (res, code, message, status = 400) => res.status(status).json({ error: { code, message } });

export function bearerAuth(token) {
  if (!token) return (_req, _res, next) => next();
  return (req, res, next) => {
    if (req.headers.authorization !== `Bearer ${token}`) return fail(res, 'UNAUTHORIZED', 'Unauthorized', 401);
    next();
  };
}

export function requestId(req, res, next) {
  req.requestId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

export function errorHandler(log) {
  return (err, _req, res, _next) => {
    if (err instanceof AppError) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    log.error({ err: err.message }, 'unhandled error');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  };
}

export function healthRouter(app, service) {
  const started = Date.now();
  app.get('/health', (_req, res) => res.json({ status: 'ok', service, uptime: Math.floor((Date.now() - started) / 1000) }));
}

export function gracefulShutdown(server, log) {
  const stop = (sig) => {
    log.info({ sig }, 'shutdown');
    server.close(() => { log.info('closed'); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000);
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT',  () => stop('SIGINT'));
}
