FROM node:22-alpine
WORKDIR /app
# Build context is ./services so the shared lib can be copied in, matching the
# other BlinkOne services. server.js imports ../_shared/lib/metrics-middleware.js.
COPY whatsapp-calls/package.json .
RUN npm install --omit=dev
COPY _shared/lib ./_shared/lib/
RUN ln -s /app/_shared /_shared
COPY whatsapp-calls/lib/ ./lib/
COPY whatsapp-calls/src/ ./src/
ENV NODE_ENV=production
EXPOSE 8803
CMD ["node", "src/server.js"]
