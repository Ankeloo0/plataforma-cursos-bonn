FROM node:24-alpine AS base
WORKDIR /app
#ffmpeg trae ffprobe, que mide la duración de los videos
RUN apk add --no-cache tzdata ffmpeg
ENV TZ=America/Mexico_City

#desarrollo
FROM base AS development
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

#compilacion
FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

#produccion
FROM base AS production
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
#migraciones
CMD ["sh", "-c", "npm run migration:run && node dist/main.js"]
