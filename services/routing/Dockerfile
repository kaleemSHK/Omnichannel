FROM node:20-alpine
WORKDIR /app
COPY routing/package.json .
RUN npm install --production
COPY _shared/lib ./_shared/lib/
COPY routing/lib/ ./lib/
COPY routing/db/ ./db/
COPY routing/src/ ./src/
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
