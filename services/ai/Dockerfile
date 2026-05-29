FROM node:20-alpine
WORKDIR /app
COPY ai/package.json .
RUN npm install --production
COPY _shared/lib ./_shared/lib/
RUN ln -s /app/_shared /_shared
COPY ai/lib/ ./lib/
COPY ai/db/ ./db/
COPY ai/src/ ./src/
COPY ai/scripts/ ./scripts/
COPY ai/seed/ ./seed/
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
