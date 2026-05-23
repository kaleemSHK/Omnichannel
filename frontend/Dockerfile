FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_CHATWOOT_URL=/_cw
ARG NEXT_PUBLIC_API_BASE=/_gw
ARG NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8080/cable
ARG NEXT_PUBLIC_SIP_WSS=ws://127.0.0.1:8080/telephony/wss
ARG NEXT_PUBLIC_SIP_DOMAIN=blinkone.local

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_CHATWOOT_URL=$NEXT_PUBLIC_CHATWOOT_URL
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV CHATWOOT_UPSTREAM=http://chatwoot:3000
ENV GATEWAY_UPSTREAM=http://gateway:8787
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_SIP_WSS=$NEXT_PUBLIC_SIP_WSS
ENV NEXT_PUBLIC_SIP_DOMAIN=$NEXT_PUBLIC_SIP_DOMAIN

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=80
ENV HOSTNAME=0.0.0.0
ENV CHATWOOT_UPSTREAM=http://chatwoot:3000
ENV GATEWAY_UPSTREAM=http://gateway:8787

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 80
CMD ["node", "server.js"]
