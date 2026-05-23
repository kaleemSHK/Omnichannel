#!/usr/bin/env bash
# Scaffold a new BlinkOne sidecar (Prompt 4)
set -euo pipefail
NAME="${1:?Usage: new-sidecar.sh <name>}"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SVC="$ROOT/services/$NAME"
PORT="${2:-8810}"

if [[ -d "$SVC" ]]; then
  echo "Service already exists: $SVC" >&2
  exit 1
fi

mkdir -p "$SVC/src" "$SVC/prisma"

cat > "$SVC/openapi.yaml" <<EOF
openapi: 3.1.0
info:
  title: BlinkOne ${NAME}
  version: 0.1.0
paths:
  /healthz:
    get:
      operationId: healthz
      responses:
        '200':
          description: OK
  /readyz:
    get:
      operationId: readyz
      responses:
        '200':
          description: Ready
  /metrics:
    get:
      operationId: metrics
      responses:
        '200':
          description: Prometheus metrics
EOF

cat > "$SVC/prisma/schema.prisma" <<EOF
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("BLINKONE_DATABASE_URL")
}

model ${NAME^}Record {
  id        String   @id @default(uuid())
  tenant_id String
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([tenant_id])
}
EOF

cat > "$SVC/src/main.ts" <<EOF
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { initTelemetry } from '@blinkone/telemetry';
import { createLogger } from '@blinkone/logger';
import { tenantContextPlugin } from '@blinkone/tenant-context';
import { AppModule } from './app.module.js';

const log = createLogger({ service: '${NAME}' });

async function bootstrap() {
  initTelemetry({ service: '${NAME}' });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { logger: false },
  );
  await app.getHttpAdapter().getInstance().register(tenantContextPlugin);
  await app.listen(Number(process.env.PORT ?? ${PORT}), '0.0.0.0');
  log.info({ port: process.env.PORT ?? ${PORT} }, '${NAME} started');
}
bootstrap().catch((e) => { log.error(e); process.exit(1); });
EOF

cat > "$SVC/src/app.module.ts" <<'EOF'
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

@Module({ controllers: [HealthController] })
export class AppModule {}
EOF

cat > "$SVC/src/health.controller.ts" <<'EOF'
import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('healthz') healthz() { return { status: 'ok' }; }
  @Get('readyz') readyz() { return { status: 'ready' }; }
  @Get('metrics') metrics() { return '# no metrics yet\n'; }
}
EOF

cat > "$SVC/package.json" <<EOF
{
  "name": "@blinkone/${NAME}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@blinkone/logger": "workspace:*",
    "@blinkone/telemetry": "workspace:*",
    "@blinkone/tenant-context": "workspace:*",
    "@nestjs/common": "^11.0.7",
    "@nestjs/core": "^11.0.7",
    "@nestjs/platform-fastify": "^11.0.7",
    "reflect-metadata": "^0.2.2"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.2",
    "typescript": "^5.7.3"
  }
}
EOF

cat > "$SVC/tsconfig.json" <<EOF
{
  "extends": "../_shared/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src"]
}
EOF

cat > "$SVC/nest-cli.json" <<EOF
{
  "sourceRoot": "src",
  "compilerOptions": { "deleteOutDir": true }
}
EOF

cat > "$SVC/Dockerfile" <<EOF
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /repo
COPY package.json pnpm-workspace.yaml ./
COPY services/_shared services/_shared
COPY services/${NAME} services/${NAME}
RUN pnpm install && pnpm --filter @blinkone/${NAME}... run build
FROM node:22-alpine
WORKDIR /app
COPY --from=build /repo/services/${NAME}/dist ./dist
ENV NODE_ENV=production PORT=${PORT}
EXPOSE ${PORT}
CMD ["node", "dist/main.js"]
EOF

cat > "$SVC/README.md" <<EOF
# BlinkOne ${NAME} sidecar

Scaffolded by \`services/_shared/scripts/new-sidecar.sh\`.

- OpenAPI: \`openapi.yaml\`
- Prisma: \`prisma/schema.prisma\` (every model includes \`tenant_id\`)
- Health: \`GET /healthz\`, \`GET /readyz\`, \`GET /metrics\`

## Run locally

\`\`\`bash
pnpm --filter @blinkone/${NAME} run build
PORT=${PORT} pnpm --filter @blinkone/${NAME} start
\`\`\`
EOF

PATCH="$ROOT/docker-compose.blinkone.yml"
echo "" >> "$PATCH"
echo "  # AUTO: ${NAME} sidecar (new-sidecar.sh)" >> "$PATCH"
echo "  ${NAME}:" >> "$PATCH"
echo "    build: { context: ., dockerfile: services/${NAME}/Dockerfile }" >> "$PATCH"
echo "    environment: { PORT: \"${PORT}\", BLINKONE_DATABASE_URL: postgresql://app:\${APP_DB_PASSWORD}@postgres_app:5432/blinkone_app }" >> "$PATCH"
echo "    networks: [blinkone]" >> "$PATCH"
echo "    expose: [\"${PORT}\"]" >> "$PATCH"

mkdir -p "$ROOT/.github/workflows"
cat > "$ROOT/.github/workflows/sidecar-${NAME}.yml" <<EOF
name: sidecar-${NAME}
on:
  push:
    paths: ['services/${NAME}/**', 'services/_shared/**']
  pull_request:
    paths: ['services/${NAME}/**', 'services/_shared/**']
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }}
      - run: pnpm install
      - run: pnpm --filter @blinkone/${NAME}... run build
EOF

echo "Created services/${NAME} — add to pnpm-workspace.yaml:"
echo "  - 'services/${NAME}'"
