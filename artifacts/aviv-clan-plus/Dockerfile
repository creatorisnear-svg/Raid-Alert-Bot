# Deploy target: Koyeb (or any plain Docker host).
#
# IMPORTANT: build context must be the MONOREPO ROOT, not this directory,
# because this app depends on the workspace package @workspace/api-client-react.
# In Koyeb's dashboard, when you point the service at your GitHub repo, set:
#   - Dockerfile location: artifacts/aviv-clan-plus/Dockerfile
#   - Work directory / build context: repo root (leave blank / "." at root)
#
# Build-time env vars (set these as "Build-time" vars in Koyeb, not runtime,
# since Vite inlines them into the static bundle):
#   - BASE_PATH=/            (standalone deploy, not path-routed like Replit)
#   - VITE_API_URL=https://<your-api-service>.koyeb.app   (the api-server's own Koyeb URL)
FROM node:22-slim AS build
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json tsconfig.json ./
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY artifacts/aviv-clan-plus/package.json artifacts/aviv-clan-plus/package.json

RUN pnpm install --frozen-lockfile --filter @workspace/aviv-clan-plus...

COPY lib/api-client-react lib/api-client-react
COPY lib/api-zod lib/api-zod
COPY artifacts/aviv-clan-plus artifacts/aviv-clan-plus

ARG BASE_PATH=/
ARG VITE_API_URL
ENV BASE_PATH=${BASE_PATH}
ENV VITE_API_URL=${VITE_API_URL}
# The Vite config requires a PORT value to exist at config-eval time even
# though the production build itself doesn't listen on a port.
ENV PORT=5173

RUN pnpm --filter @workspace/aviv-clan-plus run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/artifacts/aviv-clan-plus/dist ./dist
COPY artifacts/aviv-clan-plus/static-server.mjs ./static-server.mjs
# Koyeb sets $PORT automatically; the static server reads it via process.env.PORT.
EXPOSE 8080
CMD ["node", "static-server.mjs"]
