import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Redis } from 'ioredis';
import { initTelemetry, shutdownTelemetry } from '@blinkone/telemetry';
import { createLogger } from '@blinkone/logger';
import { AppModule } from './app.module.js';
import { HostResolverService } from './host/host-resolver.service.js';

const log = createLogger({ service: 'gateway' });

async function bootstrap(): Promise<void> {
  initTelemetry({ service: 'gateway' });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, trustProxy: true }),
    { logger: false },
  );

  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(helmet, { contentSecurityPolicy: false });

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost,http://127.0.0.1')
    .split(',')
    .map((o) => o.trim());
  await fastify.register(cors, { origin: origins, credentials: true });

  const redisUrl = process.env.BLINKONE_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://blinkone-redis:6379';
  await fastify.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX ?? 200),
    timeWindow: '1 minute',
    redis: new Redis(redisUrl),
    keyGenerator: (req) => {
      const tenant = req.headers['x-blinkone-tenant-id'];
      return typeof tenant === 'string' ? `t:${tenant}` : req.ip;
    },
  });

  fastify.addHook('onRequest', async (req, reply) => {
    const rid = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    reply.header('x-request-id', rid);
    req.id = rid;
  });

  const hostResolver = app.get(HostResolverService);
  fastify.addHook('onRequest', async (req) => {
    const host = (req.headers.host as string) || '';
    const resolved = await hostResolver.resolve(host);
    if (resolved) {
      req.headers['x-blinkone-tenant-id'] = resolved.tenantId;
      req.headers['x-blinkone-branding'] = JSON.stringify(resolved.branding ?? {});
    }
  });

  app.setGlobalPrefix('blinkone/api/v1');

  const port = Number(process.env.PORT ?? 8080);
  await app.listen(port, '0.0.0.0');
  log.info({ port }, 'BlinkOne gateway listening');

  const shutdown = async (sig: string) => {
    log.info({ sig }, 'shutdown');
    await app.close();
    await shutdownTelemetry();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err: unknown) => {
  log.error({ err }, 'gateway failed to start');
  process.exit(1);
});
