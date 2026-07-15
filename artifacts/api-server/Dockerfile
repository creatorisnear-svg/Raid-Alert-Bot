# Deploy target: Koyeb (or any plain Docker host).
#
# IMPORTANT: build context must be the MONOREPO ROOT, not this directory,
# because this service depends on workspace packages (@workspace/db,
# @workspace/api-zod). In Koyeb's dashboard, when you point the service at
# your GitHub repo, set:
#   - Dockerfile location: artifacts/api-server/Dockerfile
#   - Work directory / build context: repo root (leave blank / "." at root)
FROM node:22-slim AS build
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy just the manifests first for better layer caching.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json tsconfig.json ./
COPY lib/db/package.json lib/db/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY artifacts/api-server/package.json artifacts/api-server/package.json

RUN pnpm install --frozen-lockfile --filter @workspace/api-server... 

COPY lib/db lib/db
COPY lib/api-zod lib/api-zod
COPY artifacts/api-server artifacts/api-server

RUN pnpm --filter @workspace/api-server run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# The esbuild bundle (dist/index.mjs) contains all workspace + npm deps
# already bundled, so the runtime image needs no node_modules at all.
COPY --from=build /repo/artifacts/api-server/dist ./dist
# Koyeb sets $PORT automatically; the app reads it via process.env.PORT.
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
