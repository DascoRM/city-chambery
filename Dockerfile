# Diorama de Chambéry — image de production (site statique servi par nginx)
#
# Étape 1 : construire le site avec Node (npm run build → dist/)
# Étape 2 : servir dist/ avec nginx (image finale légère, sans Node)
# Images multi-architecture : fonctionne sur le Raspberry Pi 5 (arm64) comme sur un PC (amd64).
#
# Données : par défaut, celles du dépôt (frontend/carte/public/data/city.json, frontend/carte/public/models/) sont utilisées telles quelles.
# Avec REFRESH_DATA=true (réglé dans docker-compose.yml), le build lance aussi `npm run data`
# (OpenStreetMap + IGN) et `npm run nature`, avec retour aux données du dépôt si un service échoue
# (voir deploy/refresh-data.sh).

FROM node:22-alpine AS build
WORKDIR /app
# Dépendances d'abord (mises en cache par Docker tant que package*.json ne change pas)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG REFRESH_DATA=false
RUN if [ "$REFRESH_DATA" = "true" ]; then sh deploy/refresh-data.sh; else echo "Données du dépôt utilisées (REFRESH_DATA=false)"; fi
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q --spider http://127.0.0.1/ || exit 1
