# ─────────────────────────────────────────────────────────────
# Frontend React — un solo Dockerfile con dos destinos (targets):
#   development → servidor de Vite con recarga automática (código montado)
#   production  → compila la SPA y la sirve con nginx
# ─────────────────────────────────────────────────────────────

FROM node:24-alpine AS base
WORKDIR /app

# ── Desarrollo ───────────────────────────────────────────────
FROM base AS development
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5200
CMD ["npm", "run", "dev"]

# ── Compilación ──────────────────────────────────────────────
FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Producción (nginx) ───────────────────────────────────────
# La configuración de nginx vive en infra/prod/nginx/default.conf y se monta desde docker-compose.
FROM nginx:stable-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
