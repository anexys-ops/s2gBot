# Build React puis Nginx pour servir le front + proxy vers PHP-FPM
FROM node:20-bookworm AS frontend
WORKDIR /app
COPY react-frontend/package.json react-frontend/package-lock.json ./
RUN npm ci
COPY react-frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=frontend /app/dist /usr/share/nginx/html
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
