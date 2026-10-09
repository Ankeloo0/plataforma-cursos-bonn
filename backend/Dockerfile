# ─────────────────────────────────────────────────────────────
# API NestJS — un solo Dockerfile con dos destinos (targets):
#   development → código montado desde tu carpeta, recarga al guardar
#   production  → código compilado, sin dependencias de desarrollo, usuario no root
# docker-compose elige el destino con `build.target`.
# ─────────────────────────────────────────────────────────────

FROM node:24-alpine AS base
WORKDIR /app
# ffmpeg trae ffprobe, que mide la duración de los videos (I3.2) y después los comprimirá (I3.4)
RUN apk add --no-cache tzdata ffmpeg
ENV TZ=America/Mexico_City

# ── Desarrollo ───────────────────────────────────────────────
FROM base AS development
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# ── Compilación ──────────────────────────────────────────────
FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ── Producción ───────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
# Aplica las migraciones pendientes y después inicia la API.
CMD ["sh", "-c", "npm run migration:run && node dist/main.js"]
