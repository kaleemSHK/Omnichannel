import pino from 'pino';
import { piiSerializer, pinoMixin, PII_REDACT } from '../../_shared/lib/pii-masker.js';

/** tenant service keeps `createLogger(name)` signature (no base.service) */
export function createLogger(name) {
  return pino({
    name,
    level: process.env.LOG_LEVEL || 'info',
    serializers: piiSerializer,
    mixin: pinoMixin,
    redact: PII_REDACT,
  });
}
