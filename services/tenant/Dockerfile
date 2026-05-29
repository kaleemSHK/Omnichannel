FROM node:20-alpine
WORKDIR /app
COPY tenant/package.json .
RUN npm install --production
COPY _shared/lib ./_shared/lib/
RUN ln -s /app/_shared /_shared
COPY tenant/lib/ ./lib/
COPY tenant/db/ ./db/
COPY tenant/src/ ./src/
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
