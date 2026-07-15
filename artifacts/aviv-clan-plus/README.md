# AVIV Clan+ — Website

React/Vite/Tailwind frontend for AVIV Clan+.

Runs as its own dev workflow in this Replit workspace (`pnpm --filter
@workspace/aviv-clan-plus run dev`) for fast local iteration. **In
production it does not deploy on its own** — it's built and served by the
`api-server` service's Docker image as one combined Koyeb service (one
process, one URL, no separate frontend deployment). See
`artifacts/api-server/README.md` for the actual deploy steps and
`replit.md`'s "Deployment target: Koyeb" section for why.
