FROM node:20.18.0-alpine3.20 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27.2-alpine AS runtime
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=10 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/api/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
