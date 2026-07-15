# AVIV Clan+ — API Server + Website (combined Koyeb service)

Express + Drizzle backend for AVIV Clan+ (Discord OAuth login, clan CRUD,
join requests, raid-alert relay to Discord, web push). In production this
same service also serves the built `aviv-clan-plus` website as static files
— it's **one Koyeb service**, not two.

In this Replit workspace, the API (`pnpm --filter @workspace/api-server run
dev`) and the website (`pnpm --filter @workspace/aviv-clan-plus run dev`)
still run as two separate dev workflows — that split is only for local
development convenience (fast Vite HMR for the frontend). Production
collapses them into one process; see `STATIC_DIR` handling in `src/app.ts`.

Production runs on Koyeb, alongside `raid-alert-bot` — see the "Deployment
target: Koyeb" section in the repo's top-level `replit.md` for why.

## Deploying to Koyeb

1. Copy `.env.example` and fill in every value (Discord app credentials,
   session secret, and a **production** Postgres URL — Replit's dev database
   is not reachable from Koyeb; see the comments in that file).
2. Push the schema to that production Postgres once:
   ```bash
   DATABASE_URL="<production db url>" pnpm --filter @workspace/db run push
   ```
3. In Koyeb: create a Service → Docker → point it at this GitHub repo.
   - **Dockerfile location:** `artifacts/api-server/Dockerfile`
   - **Build context / work directory:** repo root (the Dockerfile needs
     sibling workspace packages under `lib/` and the `aviv-clan-plus`
     frontend source — it builds both the API and the website into this one
     image).
4. Set the runtime environment variables from `.env.example` in Koyeb's
   dashboard. Koyeb provides `$PORT` automatically; the Dockerfile already
   sets `STATIC_DIR` so the server serves the website too.
5. Set the health check path to `/api/healthz`.
6. Deploy. Once you have the service's public URL (e.g.
   `https://aviv-clan-plus.koyeb.app`):
   - Set `APP_URL` to that same URL in this service's env vars and redeploy.
   - Add `<that URL>/api/auth/discord/callback` as a redirect URI in the
     Discord Developer Portal.
   - Visiting that URL in a browser now serves the website, and
     `<that URL>/api/...` serves the API — same origin, no CORS/cross-domain
     configuration needed in production.
