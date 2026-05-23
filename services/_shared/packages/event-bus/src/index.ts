import { Redis } from 'ioredis';
import { z } from 'zod';

export const eventEnvelopeSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1),
  tenant_id: z.string().min(1),
  occurred_at: z.string().datetime(),
  idempotency_key: z.string().optional(),
  payload: z.record(z.unknown()),
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

export interface EventBusOptions {
  redisUrl: string;
  maxRetries?: number;
}

export class EventBus {
  private readonly redis: Redis;

  constructor(opts: EventBusOptions) {
    this.redis = new Redis(opts.redisUrl, { maxRetriesPerRequest: opts.maxRetries ?? 5 });
  }

  async publish(stream: string, event: EventEnvelope): Promise<string> {
    const parsed = eventEnvelopeSchema.parse(event);
    const id = await this.redis.xadd(
      stream,
      '*',
      'type',
      parsed.type,
      'body',
      JSON.stringify(parsed),
    );
    return id ?? '';
  }

  async consume(
    stream: string,
    group: string,
    consumer: string,
    handler: (event: EventEnvelope) => Promise<void>,
    options?: { blockMs?: number },
  ): Promise<never> {
    const blockMs = options?.blockMs ?? 5000;
    try {
      await this.redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM');
    } catch (e: unknown) {
      if (!(e instanceof Error) || !e.message.includes('BUSYGROUP')) throw e;
    }

    for (;;) {
      const rows = (await this.redis.xreadgroup(
        'GROUP',
        group,
        consumer,
        'COUNT',
        10,
        'BLOCK',
        blockMs,
        'STREAMS',
        stream,
        '>',
      )) as [string, [string, string[]][]][] | null;
      if (!rows) continue;
      for (const [, messages] of rows) {
        for (const [id, fields] of messages) {
          const bodyIdx = fields.indexOf('body');
          const body = bodyIdx >= 0 ? fields[bodyIdx + 1] : '{}';
          const event = eventEnvelopeSchema.parse(JSON.parse(body));
          try {
            if (event.idempotency_key) {
              const ok = await this.redis.set(
                `t:${event.tenant_id}:idempotency:${event.idempotency_key}`,
                '1',
                'EX',
                86400,
                'NX',
              );
              if (ok === null) {
                await this.redis.xack(stream, group, id);
                continue;
              }
            }
            await handler(event);
            await this.redis.xack(stream, group, id);
          } catch {
            const dlq = `${stream}.dlq`;
            await this.redis.xadd(dlq, '*', 'failed_id', id, 'body', body);
            await this.redis.xack(stream, group, id);
          }
        }
      }
    }
  }

  async replay(
    stream: string,
    fromId: string,
    handler: (event: EventEnvelope) => Promise<void>,
  ): Promise<void> {
    const rows = await this.redis.xrange(stream, fromId, '+');
    for (const [, fields] of rows) {
      const bodyIdx = fields.indexOf('body');
      const body = bodyIdx >= 0 ? fields[bodyIdx + 1] : '{}';
      await handler(eventEnvelopeSchema.parse(JSON.parse(body)));
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
