# Deploy target: Koyeb — SINGLE service serving both the API and the
# aviv-clan-plus website (one process, one port, one Koyeb service).
#
# IMPORTANT: build context must be the MONOREPO ROOT, not this directory,
# because this depends on workspace packages (@workspace/db, @workspace/api-zod,
# @workspace/api-client-react) and pulls in the aviv-clan-plus frontend too.
# In Koyeb's dashboard, when you point the service at your GitHub repo, set:
#   - Dockerfile location: artifacts/api-server/Dockerfile
#   - Build context / work directory: repo root (leave blank / "." at root)
#
# Build-time ARG (Vite inlines it into the static bundle, so it must be set
# as a build-time var / Docker build arg in Koyeb, not a runtime env var):
#   - none needed — same-origin deploy, so the frontend calls relative
#     "/api/..." paths and there's no separate API URL to configure.
FROM node:22-slim AS build
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy manifests first for better layer caching.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json tsconfig.json ./
COPY lib/db/package.json lib/db/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/aviv-clan-plus/package.json artifacts/aviv-clan-plus/package.json

RUN pnpm install --frozen-lockfile \
  --filter @workspace/api-server... \
  --filter @workspace/aviv-clan-plus...

COPY lib/db lib/db
COPY lib/api-zod lib/api-zod
COPY lib/api-client-react lib/api-client-react
COPY artifacts/api-server artifacts/api-server
COPY artifacts/aviv-clan-plus artifacts/aviv-clan-plus

# Backend bundle (esbuild -> dist/index.mjs, all deps inlined).
RUN pnpm --filter @workspace/api-server run build

# Frontend build. Single-service deploy, so BASE_PATH is "/" and no
# VITE_API_URL is set — the site and API share one origin, so the generated
# API client's default relative "/api/..." paths just work.
ENV BASE_PATH=/
ENV PORT=5173
RUN pnpm --filter @workspace/aviv-clan-plus run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/artifacts/api-server/dist ./dist
COPY --from=build /repo/artifacts/aviv-clan-plus/dist/public ./public
# Tells app.ts to serve the frontend + SPA fallback from this same process.
ENV STATIC_DIR=/app/public
# Koyeb sets $PORT automatically; the app reads it via process.env.PORT.
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
