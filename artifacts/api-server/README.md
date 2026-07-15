# AVIV Clan+ — API Server

Express + Drizzle backend for AVIV Clan+ (Discord OAuth login, clan CRUD,
join requests, raid-alert relay to Discord, web push).

Runs in this Replit workspace for development only (`pnpm --filter
@workspace/api-server run dev`). **Production runs on Koyeb**, alongside
`raid-alert-bot` and the `aviv-clan-plus` frontend — see the "Deployment
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
     sibling workspace packages `@workspace/db` and `@workspace/api-zod`).
4. Set the runtime environment variables from `.env.example` in Koyeb's
   dashboard. Koyeb provides `$PORT` automatically.
5. Set the health check path to `/api/healthz`.
6. Deploy. Once you have the service's public URL, put it back into
   `DISCORD_CLIENT_ID`'s app config as the OAuth redirect
   (`<this service's URL>/api/auth/discord/callback`) and into the
   `aviv-clan-plus` frontend's `VITE_API_URL` build var.
