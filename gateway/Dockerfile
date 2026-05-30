FROM node:20-alpine
WORKDIR /app
COPY gateway/package.json .
RUN npm install --production
COPY gateway/lib ./lib/
COPY gateway/src ./src/
COPY services/_shared/lib ./_shared/lib/
RUN mkdir -p /services && ln -s /app/_shared /services/_shared
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
