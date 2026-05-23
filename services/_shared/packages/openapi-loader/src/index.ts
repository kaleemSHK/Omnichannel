import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import type { FastifyInstance } from 'fastify';

interface OpenApiDoc {
  paths?: Record<string, Record<string, { operationId?: string }>>;
}

export type OperationHandlers = Record<string, (req: unknown, reply: unknown) => Promise<unknown>>;

export async function registerOpenApiRoutes(
  app: FastifyInstance,
  specPath: string,
  handlers: OperationHandlers,
  options?: { validateInDev?: boolean },
): Promise<void> {
  const raw = readFileSync(specPath, 'utf8');
  const doc = yaml.load(raw) as OpenApiDoc;
  const validate = options?.validateInDev ?? process.env.NODE_ENV === 'development';

  for (const [path, methods] of Object.entries(doc.paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (!op?.operationId) continue;
      const handler = handlers[op.operationId];
      if (!handler) {
        if (validate) {
          throw new Error(`Missing handler for operationId ${op.operationId}`);
        }
        continue;
      }
      const m = method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
      app[m](path, async (req, reply) => handler(req, reply));
    }
  }
}
