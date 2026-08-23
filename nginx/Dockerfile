FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY client/package.json client/package.json
RUN npm install
COPY client client
WORKDIR /app/client
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80 443
