import pino from 'pino';
export function createLogger(service) {
  return pino({ name: service, level: process.env.LOG_LEVEL || 'info', base: { service } });
}
