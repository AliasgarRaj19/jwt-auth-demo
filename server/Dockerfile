FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json server/package.json
RUN npm install
COPY server/prisma.config.ts server/prisma.config.ts
COPY server/prisma server/prisma
COPY server/src server/src
WORKDIR /app/server
RUN npm run prisma:generate
COPY server server
EXPOSE 4000
CMD ["node", "src/index.js"]
