FROM node:20-alpine
WORKDIR /app
COPY sla/package.json .
RUN npm install --production
COPY _shared/lib ./_shared/lib/
RUN ln -s /app/_shared /_shared
COPY sla/lib/ ./lib/
COPY sla/db/ ./db/
COPY sla/src/ ./src/
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
