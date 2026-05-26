import pino from 'pino';
import { piiSerializer, pinoMixin, PII_REDACT } from '../../_shared/lib/pii-masker.js';

export function createLogger(service) {
  return pino({
    name: service,
    level: process.env.LOG_LEVEL || 'info',
    base: { service },
    serializers: piiSerializer,
    mixin: pinoMixin,
    redact: PII_REDACT,
  });
}
