FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /repo
COPY package.json pnpm-workspace.yaml ./
COPY services/_shared ./services/_shared
COPY services/gateway ./services/gateway
RUN pnpm install
RUN pnpm --filter @blinkone/gateway... run build

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/services ./services
RUN addgroup -g 1001 blinkone && adduser -u 1001 -G blinkone -D blinkone
USER blinkone
EXPOSE 8080
CMD ["node", "services/gateway/dist/main.js"]
