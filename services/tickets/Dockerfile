FROM node:20-alpine
WORKDIR /app
COPY tickets/package.json .
RUN npm install --production
COPY _shared/lib ./_shared/lib/
RUN ln -s /app/_shared /_shared
COPY tickets/lib/ ./lib/
COPY tickets/db/ ./db/
COPY tickets/src/ ./src/
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
