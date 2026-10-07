FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# postinstall copies Cesium assets, so scripts/ must exist before npm ci
COPY scripts ./scripts
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
