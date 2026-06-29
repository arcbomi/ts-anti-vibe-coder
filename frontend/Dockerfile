# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app/frontend
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm ci

FROM base AS dev
COPY . .
RUN chmod +x ./scripts/start-dev.sh
EXPOSE 5173
CMD ["sh", "./scripts/start-dev.sh"]

FROM base AS build
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
