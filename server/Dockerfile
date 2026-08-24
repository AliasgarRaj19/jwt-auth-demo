FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json server/package.json
RUN npm install
COPY server/prisma.config.ts server/prisma.config.ts
COPY server/prisma server/prisma
COPY server/src server/src
COPY server/scripts server/scripts
WORKDIR /app/server
RUN npm run prisma:generate
COPY server server
RUN addgroup -g 10001 -S jwtapp && adduser -S -D -H -u 10001 -G jwtapp jwtapp && chown -R jwtapp:jwtapp /app
EXPOSE 4000
USER jwtapp:jwtapp
CMD ["node", "src/index.js"]
