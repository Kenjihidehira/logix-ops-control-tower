FROM node:24-alpine

WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
COPY data ./data
COPY docs ./docs

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "src/server.js"]
