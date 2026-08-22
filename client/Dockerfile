# Development image used by docker-compose.yml.
# The client source is bind-mounted by Compose so Vite can hot reload changes.
FROM node:20-alpine
WORKDIR /repo

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci --workspace client --include-workspace-root

COPY client ./client
WORKDIR /repo/client

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
