FROM node:20-alpine
WORKDIR /app
COPY integration/package.json .
RUN npm install --production
COPY _shared/lib ./_shared/lib/
RUN ln -s /app/_shared /_shared
COPY integration/lib/ ./lib/
COPY integration/db/ ./db/
COPY integration/src/ ./src/
COPY integration/openapi.yaml ./
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
