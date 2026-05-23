FROM node:20-alpine
WORKDIR /app
COPY escalation/package.json .
RUN npm install --production
COPY _shared/lib ./_shared/lib/
COPY escalation/lib/ ./lib/
COPY escalation/db/ ./db/
COPY escalation/src/ ./src/
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
