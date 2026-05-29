FROM node:20-alpine
WORKDIR /app
COPY ivr/package.json .
RUN npm install --production
COPY _shared/lib ./_shared/lib/
RUN ln -s /app/_shared /_shared
COPY ivr/lib/ ./lib/
COPY ivr/src/ ./src/
COPY ivr/db/ ./db/
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
