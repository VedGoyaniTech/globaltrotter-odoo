# Build from the repo root:  docker build -f server/Dockerfile .
FROM node:20-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci --workspace server --include-workspace-root

COPY server ./server
RUN npm run db:generate -w server && npm run build -w server

# Drop dev dependencies, then keep the generated Prisma client.
RUN npm prune --omit=dev --workspace server --include-workspace-root \
  && npm run db:generate -w server

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/server/dist ./dist
COPY --from=build /repo/server/prisma ./prisma
COPY --from=build /repo/server/package.json ./package.json

# Uploads are written at runtime by the unprivileged user, so the directory has
# to exist and be owned by it before the drop. Mount a volume here to persist
# images across container restarts.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
VOLUME ["/app/uploads"]

USER node
EXPOSE 4000

# Migrations are applied on boot so a fresh environment self-provisions.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
