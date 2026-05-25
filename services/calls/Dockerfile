FROM node:20-alpine
WORKDIR /app
COPY calls/package.json .
RUN npm install --production
COPY _shared/lib ./_shared/lib/
COPY calls/lib/ ./lib/
COPY calls/db/ ./db/
COPY calls/src/ ./src/
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
