FROM node:20-alpine
WORKDIR /app
COPY platform/package.json .
RUN npm install --production
COPY _shared/lib ./_shared/lib/
RUN ln -s /app/_shared /_shared
COPY platform/lib/ ./lib/
COPY platform/src/ ./src/
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
