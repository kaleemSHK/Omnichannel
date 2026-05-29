FROM node:20-alpine
WORKDIR /app
COPY recording/package.json .
RUN npm install --production
COPY _shared/lib ./_shared/lib/
RUN ln -s /app/_shared /_shared
COPY recording/lib/ ./lib/
COPY recording/src/ ./src/
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
