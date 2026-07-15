---
name: AVIV Clan+ / raid-alert-bot deploy entirely on Koyeb
description: The user runs this whole project's production services on Koyeb, not Replit Deployments — read before suggesting Replit Publish or touching prod infra.
---

The user hosts everything in production on Koyeb (they have their own Koyeb
account/project), not on Replit. This covers the full stack: `raid-alert-bot`,
`artifacts/api-server` (which also serves the built `aviv-clan-plus`
website — see below), and the production Postgres database.

**Why:** stated explicitly by the user (2026-07-15) when asked to scope a
Discord/database "set up everything" request — confirmed "all of it" runs on
Koyeb and that they already have Koyeb configured.

**How to apply:**
- Treat Replit purely as the dev environment: write code here, use the dev
  workflows for live preview, and use Replit's dev Postgres only for local
  iteration/schema authoring.
- Do not suggest Replit's Publish/Deployments flow for these services, and
  do not run production migrations against Replit's managed Postgres — it's
  not the production database.
- The agent has no Koyeb account access — infra actions (creating services,
  setting env vars in Koyeb's dashboard, provisioning a Koyeb-reachable
  Postgres, creating the Discord Developer Portal app) are the user's to do.
  The agent's job is to keep the repo Koyeb-deployable (working Dockerfiles,
  `.env.example` files, README instructions) and to say so clearly rather
  than silently trying to deploy via Replit.

## AVIV Clan+ website + API: ONE Koyeb service, not two

The user explicitly asked for the website and API to run as a single Koyeb
service, not split. `artifacts/api-server/Dockerfile` builds both
`aviv-clan-plus` (frontend) and `api-server` (backend) into one image; the
Express app serves the API under `/api/*` and the built frontend + SPA
fallback for everything else, gated on a `STATIC_DIR` env var (only set in
that Dockerfile's image, so the Replit dev workflow split — two separate
dev servers for fast HMR — is unaffected). There is intentionally no
`artifacts/aviv-clan-plus/Dockerfile`; don't recreate one unless the user
asks to go back to two services.

**Why:** simpler ops for the user (one deploy, one URL, no CORS/cross-origin
config to maintain in production) — explicit preference, not a technical
constraint.

**How to apply:** any change to how the frontend is built or served in
production should go through `artifacts/api-server/Dockerfile` and the
`STATIC_DIR` handling in `artifacts/api-server/src/app.ts`, not a new
standalone frontend deployment path.
