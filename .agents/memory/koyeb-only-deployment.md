---
name: AVIV Clan+ / raid-alert-bot deploy entirely on Koyeb
description: The user runs this whole project's production services on Koyeb, not Replit Deployments — read before suggesting Replit Publish or touching prod infra.
---

The user hosts everything in production on Koyeb (they have their own Koyeb
account/project), not on Replit. This covers the full stack: `raid-alert-bot`,
`artifacts/api-server`, `artifacts/aviv-clan-plus`, and the production
Postgres database.

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
- Each deployable service should have a Dockerfile with a comment stating
  Koyeb is the deploy target (see `raid-alert-bot/Dockerfile`,
  `artifacts/api-server/Dockerfile`, `artifacts/aviv-clan-plus/Dockerfile`).
  Monorepo services (under `artifacts/`) need their Docker build context set
  to the repo root, not the artifact subdirectory, because they depend on
  `workspace:*` packages under `lib/`.
- The agent has no Koyeb account access — infra actions (creating services,
  setting env vars in Koyeb's dashboard, provisioning a Koyeb-reachable
  Postgres, creating the Discord Developer Portal app) are the user's to do.
  The agent's job is to keep the repo Koyeb-deployable (working Dockerfiles,
  `.env.example` files, README instructions) and to say so clearly rather
  than silently trying to deploy via Replit.
