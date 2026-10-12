FROM node:24-alpine AS base
WORKDIR /app

#desarrollo
FROM base AS development
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5200
CMD ["npm", "run", "dev"]

#compilacion
FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

#produccion
FROM nginx:stable-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
