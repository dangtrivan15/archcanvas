# Stage 1: Build
FROM node:22-slim AS builder
WORKDIR /app

# Copy shared src-web types (needed for tsup alias resolution during build)
COPY src-web/types/ ./src-web/types/
COPY src-web/core/registry/validator.ts ./src-web/core/registry/validator.ts

# Copy server package and install
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci

# Copy server source and build with tsup
COPY server/tsup.config.ts ./server/
COPY server/tsconfig.json ./server/
COPY server/src/ ./server/src/
RUN cd server && npm run build

# Stage 2: Runtime
FROM node:22-slim
WORKDIR /app

# Copy bundled output and native dependencies
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/package.json ./
COPY --from=builder /app/server/src/db/migrations ./migrations

RUN mkdir -p /data
ENV DATABASE_PATH=/data/registry.db
EXPOSE 3001
CMD ["node", "dist/index.js"]
