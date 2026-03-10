FROM node:22-slim
WORKDIR /app
COPY . .
WORKDIR /app/site
RUN npm ci --production
WORKDIR /app
CMD ["node", "site/server.js"]
