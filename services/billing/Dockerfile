FROM node:20-alpine
WORKDIR /app
COPY billing/package.json .
RUN npm install --production
COPY _shared/lib ./_shared/lib/
RUN ln -s /app/_shared /_shared
COPY billing/lib/ ./lib/
COPY billing/db/ ./db/
COPY billing/src/ ./src/
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
