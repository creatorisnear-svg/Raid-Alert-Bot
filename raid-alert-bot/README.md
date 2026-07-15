# raid-alert-bot

Listens for KAOS+ raid alerts (Rust console clan raid-notification system)
without a browser or phone, by registering itself as a real headless "device"
with Google's push infrastructure, and reposts every alert to a Discord
channel via webhook, pinging `@everyone` or a specific role.

See `.agents/memory/fake-webpush-device-via-gcm-checkin.md` in the main repo
for how the underlying technique works and why it's reliable.

## How it works, in short

1. On first run, it registers a fake "device" with Google (no browser, no
   Firebase project needed) and gives that device's push address to KAOS+
   using your raid key -- exactly as if you'd clicked "Enable Alerts" on your
   phone.
2. It keeps a persistent connection open to Google so raid alerts are
   delivered directly to it, decrypted, in real time.
3. Every alert is posted to your Discord channel via a webhook, pinging
   whichever role (or `@everyone`) you configured.

**Trade-off:** registering this bot as the device replaces whatever was
registered before (e.g. your phone). If you also want alerts on your phone,
reopen KAOS+ and tap "Enable Alerts" again after this bot's first run --
KAOS+ only appears to support one registered device per raid key, so re-enabling
your phone will silently take the slot back from the bot and you'll need to
decide which one should be primary, or check with KAOS+'s developer about
support for multiple simultaneous devices.

## Setup

1. Copy `.env.example` to `.env` and fill in:
   - `RAID_KEY` -- your personal KAOS+ raid key (`/raidlink` in-game).
   - `KAOS_API_KEY` -- the `X-Api-Key` value KAOS+ sends its backend (visible
     in your browser's network tab while using the KAOS+ app).
   - `DISCORD_WEBHOOK_URL` -- create one under the target channel's Settings
     -> Integrations -> Webhooks -> New Webhook -> Copy Webhook URL.
   - `PING_TARGET` -- `everyone` (default) or a Discord role ID to ping that
     role instead. Change this any time and restart the app -- no code
     changes needed.
2. Install dependencies and run locally:
   ```bash
   npm install
   npm run dev
   ```
3. On first successful run, check the logs for a `CREDENTIALS_JSON=...` line
   and save it as an environment variable in your deployment (see below) --
   this lets restarts/redeploys reuse the same device instead of registering
   a new one every time.

## Deploying to Koyeb

1. Push this `raid-alert-bot/` directory to its own GitHub repo (or a
   subdirectory Koyeb can build from).
2. In Koyeb, create a new Service -> Docker -> point it at this repo/directory
   (it will use the included `Dockerfile`).
3. Set the environment variables from `.env.example` in Koyeb's dashboard
   (`RAID_KEY`, `KAOS_API_KEY`, `DISCORD_WEBHOOK_URL`, `PING_TARGET`, and --
   after the first successful run -- `CREDENTIALS_JSON`).
4. Koyeb provides `$PORT` automatically; the app already reads it. Set the
   service's health check path to `/health`.
5. Deploy. Koyeb keeps the service running continuously (it does not need
   incoming web traffic to stay alive, unlike some serverless platforms).

## Uptime monitoring

The app exposes:

- `GET /health` -- returns HTTP 200 with `{ status: "ok", pushListenerConnected: true, ... }`
  when the Google push connection is up, or HTTP 503 if it's currently
  disconnected (the library auto-reconnects with backoff, so brief 503s are
  expected and not necessarily an outage).
- `GET /` -- always returns 200 if the process is alive at all, regardless of
  push connection state.

Point [UptimeRobot](https://uptimerobot.com) (or any monitor) at your Koyeb
service's public URL + `/health`, e.g. `https://your-app.koyeb.app/health`.
Set the check interval to whatever your UptimeRobot plan allows (5 minutes on
the free plan) and enable alerting so you find out if the bot goes down.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `RAID_KEY` | yes | Your personal KAOS+ raid key. Treat as a secret. |
| `KAOS_API_KEY` | yes | KAOS+ app's shared API key. Treat as a secret. |
| `DISCORD_WEBHOOK_URL` | yes | Treat as a secret -- anyone with it can post to your channel. |
| `PING_TARGET` | no (default `everyone`) | `everyone` or a Discord role ID. |
| `CREDENTIALS_JSON` | no | Set after first run so redeploys don't re-register. |
| `PORT` | no | Set automatically by Koyeb/Replit. |
