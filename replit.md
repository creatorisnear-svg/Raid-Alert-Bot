# Rust Clan Raid Alert Bot

A Node.js/TypeScript service that intercepts KAOS+ raid-alert push notifications
headlessly (no browser, no phone) and forwards them to:
1. A Discord channel via webhook (`@everyone` or a specific role ping).
2. Any clan member who has installed the bundled PWA on their phone.

## Background / why this is unusual

The user has no admin rights on the Discord server where KAOSBOT posts alerts,
so the normal approach (invite a bot, read the channel) isn't available yet.
Instead, we reverse-engineered KAOS+'s private Web Push pipeline to intercept
alerts directly.

## How KAOS+ delivers raid alerts (reverse-engineered)

- KAOS+ (`bot-app.ka0s.uk`) is a PWA. When a user clicks "ENABLE ALERTS", the
  browser creates a standard Web Push subscription and POSTs it to
  `https://bot-app.ka0s.uk/api.php?endpoint=register-device`, authenticated via
  header `X-Api-Key` + cookie `raid_key=<user's personal key>`.
- Request body shape: `{ raid_key, device_token: { endpoint, expirationTime, keys: { p256dh, auth } } }`.
- KAOS's VAPID public key is embedded in `bot-app.ka0s.uk/index.php`:
  `BK1HQ_7Wrsb85NjJtQ9HlCAQ3KxUwlgUej4hEy7aTHoszHk913Pob27Q0JWz5y48wZVtY9vVPAmaevT0VXmd764`
- Their service worker uses the plain browser Push API — no Firebase SDK needed.
  The `fcm.googleapis.com` address in real subscriptions is just Chrome's internal
  push transport, not evidence of a KAOS-owned Firebase project.

## Path A (implemented): headless "fake device" push receiver

The bot registers itself as a real headless Chrome device with Google, then
registers that device's FCM endpoint with KAOS's `register-device` API.
Incoming alerts are decrypted and forwarded to Discord + clan PWA subscribers.

**Status as of 2026-07-15:** End-to-end confirmed working. Test alerts ("TEST
RAID ALERT" button in KAOS+) arrive and get posted to Discord. Real raid alerts
also appear to route through the same channel — see "Known issue" below.

**Known trade-off:** registering this bot as the device replaces whatever was
registered before (e.g. your phone). If you also want alerts on your phone,
reopen KAOS+ and tap "Enable Alerts" again — but that will take the slot from
the bot.

## ✅ What's done

- `src/pushListener.ts` — headless GCM checkin + Google MCS persistent
  connection; auto-reconnect watchdog; verbose heartbeat logging; logs every
  raw push (not just parsed alerts) for debugging.
- `src/credentialsStore.ts` — persists the Google device credentials so
  restarts don't register a new device each time.
- `src/discord.ts` — posts raid alerts to Discord webhook with `@everyone` or
  role ping.
- `src/vapidStore.ts` — generates and persists our own VAPID key pair for the
  clan PWA (stable across restarts; must not change once members have subscribed).
- `src/subscribersStore.ts` — file-backed list of clan member push subscriptions.
- `src/webPush.ts` — pushes alerts to all subscribed clan members' phones.
- `src/server.ts` — Express server:
  - `GET /` — serves clan PWA (`public/index.html`).
  - `GET /api/config` — returns clan name + VAPID public key.
  - `POST /api/subscribe` / `POST /api/unsubscribe` — manage clan subscriptions.
  - `GET /health` — 200/503 based on push-connection state (for UptimeRobot).
- `public/index.html` — installable clan PWA: subscribe/unsubscribe buttons,
  connection status indicator, recent-alert history, siren playback, flash overlay.
- `public/sw.js` — service worker: shows system notifications on push, relays
  to open tabs, re-focuses on notification click.
- `public/manifest.json` — PWA manifest (TCK branding, dark theme).
- `public/icons/icon-192.png`, `icon-512.png` — TCK clan emblem icons.
- `public/audio/siren.mp3`, `siren.wav` — alert siren audio.

## ⏳ What still needs doing / open issues

### 1. Set up secrets (REQUIRED before the bot can run)
The workflow fails at startup without these. Set them via Replit's Secrets panel:

| Secret | Description |
|---|---|
| `RAID_KEY` | Your personal KAOS+ raid key (from `/raidlink` in-game). |
| `KAOS_API_KEY` | The `X-Api-Key` KAOS+ sends its backend (visible in browser network tab). |
| `DISCORD_WEBHOOK_URL` | Discord channel webhook URL. |
| `PING_TARGET` | `everyone` (default) or a Discord role ID. |
| `CREDENTIALS_JSON` | Leave blank on first run; copy from logs after first run so restarts reuse the same device. |
| `CLAN_NAME` | Optional; defaults to `TCK`. |
| `VAPID_KEYS_JSON` | Leave blank on first run; copy from logs after first run so restarts don't invalidate clan PWA subscriptions. |

### 2. Diagnose real raid alert delivery (open bug)
Test alerts ("TEST RAID ALERT" button in KAOS+) arrive reliably.
Real sensor-triggered alerts have not yet been confirmed end-to-end — the bot
worked for ~50 seconds on one test, then nothing arrived in Koyeb logs when a
real raid occurred. Possible causes:
- KAOS backend sends real alerts on a different frequency/channel subscription
  not set during device registration.
- A toggle in KAOSBOT's Discord settings controls whether push fires for real
  alerts (separate from the test button). Check KAOSBOT's Discord slash commands
  for any "push notification enable" option.
- Aggressive Koyeb/network idle-connection timeouts dropping the MCS socket
  silently. The watchdog (15-min stale threshold + UptimeRobot pings) should
  catch this, but needs real-world confirmation.
- Action: trigger a real raid next test session, immediately pull Koyeb logs,
  and match timestamps against when the sensor actually fired.

### 3. Deploy to Koyeb (final step)
This bot is intended to run on Koyeb, not Replit deployments.
- Push `raid-alert-bot/` (or the whole repo) to GitHub.
- Create a Koyeb service -> Docker -> point at repo.
- Set all secrets above in Koyeb's environment variable panel.
- Health check path: `/health`.
- After first run, copy `CREDENTIALS_JSON` and `VAPID_KEYS_JSON` from logs into
  Koyeb env vars so redeploys don't re-register a new device.
- Point UptimeRobot at `https://your-app.koyeb.app/health` (5-min interval).

### 4. Path B (fallback — not built)
If real alerts never arrive via Path A: build a standard Discord bot that reads
KAOSBOT's own raid-alert messages and reposts with `@everyone`. Needs a clan
admin to do a one-time bot invite to the server.

## Deployment: Koyeb (production)

This bot is deployed and runs on **Koyeb**, not on Replit. Replit is used only
as the code editor. Do not use Replit's deployment/publish feature for this project.

### Koyeb setup
1. Push the repo (or the `raid-alert-bot/` subdirectory) to GitHub.
2. Koyeb → New Service → Docker → point at the repo (uses the included `Dockerfile`).
3. Set all secrets from the table above in Koyeb's environment variable panel.
4. Health check path: `/health`.
5. After first run, copy the `CREDENTIALS_JSON=...` and `VAPID_KEYS_JSON=...` lines
   from Koyeb's logs and paste them back as environment variables so redeploys don't
   register a new device (which would break push delivery) or regenerate VAPID keys
   (which would break all clan PWA subscriptions).
6. Point UptimeRobot at `https://your-app.koyeb.app/health` (5-min interval) to
   alert if the bot goes down.

### Running on Replit (dev / testing only)
Replit can run the bot temporarily for development, but it is NOT the production host.
1. Set the secrets above in Replit's Secrets panel.
2. The "Raid Alert Bot" workflow runs `cd raid-alert-bot && npm run start`.
3. On first run, check logs for `CREDENTIALS_JSON=...` and `VAPID_KEYS_JSON=...`
   lines — save those as secrets if you want to reuse the same device across restarts.

## Stack
- Node.js, TypeScript, Express 4
- `@eneris/push-receiver` — headless GCM/MCS client
- `web-push` — VAPID-signed push to clan PWA subscribers
- Deployment target: **Koyeb** (Docker, `Dockerfile` included)

## Architecture decisions
- Chose direct push-interception (Path A) over Discord-channel-reading bot
  (Path B) at user's explicit request, despite higher complexity.
- Device registration on the user's raid key gets overwritten every time we
  register — user must re-enable real alerts afterward each time.

## Gotchas for future agents
- Every time the bot registers a new device (no `CREDENTIALS_JSON` set), it
  overwrites the user's real KAOS+ device slot. Always remind user to reopen
  KAOS+ and tap "ENABLE ALERTS" to restore phone notifications after each test.
- KAOS's `register-device` endpoint returns 200 for any endpoint, including
  fake ones — a successful response is **not** proof the push will actually
  arrive. Only a real Google-issued FCM token works.
- VAPID keys for the clan PWA must never change once members have subscribed.
  Changing them invalidates all existing subscriptions — everyone must reinstall.
- The `artifacts/` directory and `api-server`/`mockup-sandbox` workflows are
  Replit template scaffolding added automatically; they are **not** part of
  the raid-alert bot and can be ignored or removed.

## User preferences
- Final deployment target is **Koyeb**, not Replit deployments.
- Alert message should ping `@everyone` (or a configured role) with raider name
  and server number.
- Secrets must go through Replit's environment-secrets storage — never hardcoded.
- User wants: after finishing a chunk of work, update `replit.md` with what's
  done and what's left so the next agent knows where to pick up.

## 2026-07-15 setup pass

**raid-alert-bot (standalone, deployed to Koyeb by the user):**
- `npm install` + `npm run build` (`tsc`) succeed with zero errors — code is
  verified healthy.
- The "Raid Alert Bot" Replit workflow fails, and is *expected* to fail here:
  it throws `Missing required environment variable: RAID_KEY` because no
  KAOS_API_KEY/DISCORD_WEBHOOK_URL/RAID_KEY secrets are set in this Replit
  environment. That's fine — per user, this bot is not meant to run on
  Replit; they deploy it to Koyeb themselves following the README/this file's
  "Deployment: Koyeb" section. Do not add these as Replit secrets or try to
  make the Replit workflow pass unless the user asks to run it here.

**New SaaS scaffolding — "AVIV Clan+" (this is the "saas/website for clans"
the user is building; separate from the raid-alert-bot above):**
- `artifacts/api-server` — Express/TS API (routes: `auth`, `clans`, `members`,
  `invite`, `joinRequests`, `alerts`, `push`, `discord`, `me`, `health`).
  Discord-based auth (`src/routes/auth.ts`), session middleware
  (`src/lib/session.ts`), a raid-listener manager
  (`src/lib/raidListenerManager.ts`) and web-push (`src/lib/webPush.ts`) —
  looks like the multi-tenant successor to raid-alert-bot's single-clan
  Express server.
- `artifacts/aviv-clan-plus` — React/Vite/Tailwind (shadcn) frontend. Pages:
  `home`, `dashboard`, `search`, `invite`, `clans/*`. Landing page copy:
  "Raid Alerts, Perfected" / "Tactical coordination software for Rust clans."
  Auth flow is "Sign in with Discord".
- Both artifacts existed as source but had never had `pnpm install` run at
  the workspace root, so all three artifact workflows (`api-server`,
  `aviv-clan-plus`, `mockup-sandbox`) failed with `vite: not found` /
  `Cannot find package 'esbuild'`. Fixed by running `pnpm install` at the
  repo root — all three now start cleanly. `api-server` logs
  `VAPID keys not set — web push notifications disabled` (expected, no
  secrets configured yet) and otherwise serves requests fine (401 on
  `/api/auth/me` is expected when logged out).
- **Not yet done:** no functional review of the AVIV Clan+ feature set was
  performed beyond confirming the pages/routes exist and the servers boot.
  Continuing that build-out (auth wiring, clan CRUD end-to-end, real data
  instead of any stubs, connecting the frontend pages to the API server) is
  proposed as a follow-up task — see project tasks.

## 2026-07-15 legal, accessibility, and mobile pass (AVIV Clan+ website)

- Added `/terms` and `/privacy` pages (`src/pages/legal/terms.tsx`,
  `src/pages/legal/privacy.tsx`), wired into `App.tsx`. Content covers GDPR
  (EU/UK) and CCPA/CPRA (US) — data collected, legal basis, cookies (one
  essential session cookie only, no consent banner needed), user rights
  (access/delete/export/object), children's privacy, and an accessibility
  commitment section. **This is good-faith boilerplate, not legal advice** —
  if the user has an EU or US entity, a lawyer should review before relying
  on it for real compliance obligations (e.g. a formal Data Processing
  Agreement with hosting/Discord, or a DPO if required).
- Support email `creatorisnear@gmail.com` is now surfced sitewide via a new
  `SiteFooter` component (`src/components/site-footer.tsx`, exports
  `SUPPORT_EMAIL`) — footer nav on the home page links to Terms, Privacy, and
  a `mailto:` support link, plus a disclaimer that AVIV Clan+ is unaffiliated
  with Facepunch/Rust/KAOS+/Discord. The same email is referenced in the
  legal pages' contact sections.
- Accessibility (WCAG-oriented) pass: "Skip to content" links on the home
  page, legal pages, and authenticated app layout; `aria-label`s on icon-only
  buttons (mobile menu trigger, approve/reject join-request buttons); `alt`
  text on all clan/user avatar images; a visually-hidden `<label>` added to
  the clan search input. Not a full WCAG audit — no automated screen-reader
  testing was performed.
- Mobile fix: the home page hero headline ("Raid Alerts Perfected") was
  overflowing horizontally on narrow phones (iPhone/Android widths ~360–412px)
  because of a fixed `text-5xl` + `tracking-widest` combo. Fixed with
  responsive sizing (`text-4xl sm:text-5xl md:text-7xl`,
  `tracking-wide sm:tracking-widest`, `break-words`). Verified visually at
  390×844 (iPhone) and 412×915 (Samsung-class) viewports — home, `/terms`,
  and `/privacy` all render cleanly with no clipped or overflowing content.
  Authenticated pages (dashboard/search/clan pages) were not re-screenshotted
  (they require a Discord login) but already used responsive Tailwind
  classes (`grid-cols-1 md:...`, `flex-col md:flex-row`) prior to this pass.

## Deployment target: Koyeb, not Replit Deployments — READ THIS FIRST

**The user hosts everything outside Replit, on Koyeb (they already have a
Koyeb account/project set up).** This applies to the whole AVIV Clan+ stack —
`artifacts/api-server`, `artifacts/aviv-clan-plus`, and its Postgres database
— not just `raid-alert-bot`. Do not suggest Replit's Publish/Deployments
flow for these. Replit is the **development environment only**: use it to
write code, run the dev workflows for live preview, and provision Replit's
dev Postgres for local iteration — then hand off to Koyeb for anything that
needs to run continuously in production.

What's already in place for Koyeb deployment (as of 2026-07-15):
- `raid-alert-bot/Dockerfile` — already deployed by the user (pre-existing,
  unchanged by this pass).
- `artifacts/api-server/Dockerfile` and `artifacts/aviv-clan-plus/Dockerfile`
  — added so both can be deployed the same way. **Build context for both
  must be the monorepo root** (not the artifact subdirectory), because they
  depend on workspace packages (`@workspace/db`, `@workspace/api-zod`,
  `@workspace/api-client-react`). Set "Dockerfile location" in Koyeb to the
  artifact's `Dockerfile` path but leave the build context/work directory at
  repo root.
- `.env.example` in each of those two artifact directories lists the exact
  env vars Koyeb needs and where to get them (Discord app credentials,
  session secret, database URL, public API URL). `aviv-clan-plus`'s vars are
  **build-time** (Vite inlines them), `api-server`'s are runtime.
- The frontend's API client now supports a configurable base URL
  (`VITE_API_URL` → `setBaseUrl()` in `src/main.tsx`) since on Koyeb the
  frontend and API are separate services on separate domains, unlike Replit
  where they share one domain via path routing (`BASE_PATH` must be `/` for
  the standalone Koyeb build, vs. the artifact-specific prefix on Replit).
- **Database**: Replit's built-in dev Postgres (`DATABASE_URL` pointing at
  host `helium`) is only reachable from inside the Replit workspace — it
  will NOT work as the production database from Koyeb. The user needs a
  Postgres instance Koyeb can reach (Koyeb's own Postgres add-on, Neon,
  Supabase, etc.), then push the schema to it once with
  `DATABASE_URL="<that url>" pnpm --filter @workspace/db run push`. This has
  NOT been done yet — the schema has only been pushed to the Replit dev
  database so far.
- **Discord app**: still needs to be created by the user at
  https://discord.com/developers/applications (OAuth client ID/secret + bot
  token) — the user declined Replit's Discord connector, so this must be
  done manually. Redirect URI must be
  `<api-server's Koyeb URL>/api/auth/discord/callback`.
- Not yet done: actually building/pushing these Docker images to Koyeb (the
  agent has no Koyeb credentials/access — this is the user's own account),
  provisioning the production Postgres, and creating the Discord app. The
  agent prepared the repo to make that a config/dashboard task rather than a
  code task.
