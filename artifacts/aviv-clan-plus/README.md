# AVIV Clan+ — Website

React/Vite/Tailwind frontend for AVIV Clan+.

Runs in this Replit workspace for development only (`pnpm --filter
@workspace/aviv-clan-plus run dev`). **Production runs on Koyeb**, alongside
`raid-alert-bot` and the `api-server` — see the "Deployment target: Koyeb"
section in the repo's top-level `replit.md` for why.

## Deploying to Koyeb

1. Deploy `artifacts/api-server` first (see its own README) — you need its
   public URL for step 3 below.
2. Copy `.env.example` and fill in `VITE_API_URL` with that URL.
3. In Koyeb: create a Service → Docker → point it at this GitHub repo.
   - **Dockerfile location:** `artifacts/aviv-clan-plus/Dockerfile`
   - **Build context / work directory:** repo root (the Dockerfile needs
     the sibling workspace package `@workspace/api-client-react`).
   - Set `BASE_PATH` and `VITE_API_URL` as **build-time** variables / Docker
     build args (Vite inlines them into the static bundle — setting them as
     runtime env vars has no effect).
4. Deploy. Koyeb provides `$PORT` automatically; the container's built-in
   static file server (`static-server.mjs`) reads it and also handles
   client-side route fallbacks (so refreshing `/dashboard` etc. works).
