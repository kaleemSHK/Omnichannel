FROM node:20-alpine
WORKDIR /app
COPY ai/package.json .
RUN npm install --production
COPY _shared/lib ./_shared/lib/
COPY ai/lib/ ./lib/
COPY ai/db/ ./db/
COPY ai/src/ ./src/
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
