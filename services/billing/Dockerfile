FROM node:20-alpine
WORKDIR /app
COPY billing/package.json .
RUN npm install --production
COPY _shared/lib ./_shared/lib/
COPY billing/lib/ ./lib/
COPY billing/db/ ./db/
COPY billing/src/ ./src/
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
