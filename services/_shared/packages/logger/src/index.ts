import pino, { type Logger, type LoggerOptions } from 'pino';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface LogContext {
  tenantId?: string;
  correlationId?: string;
  userId?: string;
}

const logContext = new AsyncLocalStorage<LogContext>();

const REDACT_PATHS = [
  'authorization',
  'cookie',
  'password',
  'card_number',
  'phone_number_full',
  'req.headers.authorization',
  'req.headers.cookie',
];

export function runWithLogContext<T>(ctx: LogContext, fn: () => T): T {
  return logContext.run(ctx, fn);
}

export function getLogContext(): LogContext | undefined {
  return logContext.getStore();
}

export function createLogger(opts: { service: string; level?: string }): Logger {
  const isDev = process.env.NODE_ENV !== 'production';
  const base: LoggerOptions = {
    name: opts.service,
    level: opts.level ?? process.env.LOG_LEVEL ?? 'info',
    redact: REDACT_PATHS,
    mixin() {
      const ctx = logContext.getStore();
      if (!ctx) return {};
      return {
        tenant_id: ctx.tenantId,
        correlation_id: ctx.correlationId,
        user_id: ctx.userId,
      };
    },
  };

  if (isDev) {
    return pino({
      ...base,
      transport: { target: 'pino-pretty', options: { colorize: true } },
    });
  }
  return pino(base);
}

export { logContext };
