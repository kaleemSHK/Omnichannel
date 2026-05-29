FROM node:20-alpine
WORKDIR /app
COPY routing/package.json .
RUN npm install --production
COPY _shared/lib ./_shared/lib/
RUN ln -s /app/_shared /_shared
COPY routing/lib/ ./lib/
COPY routing/db/ ./db/
COPY routing/src/ ./src/
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
