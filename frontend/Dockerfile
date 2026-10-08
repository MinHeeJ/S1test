FROM node:20.19.0-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN if [ ! -f package-lock.json ]; then npm install --package-lock-only; fi && npm ci
COPY . .
RUN npm run build
FROM nginxinc/nginx-unprivileged:1.27.4-alpine
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
