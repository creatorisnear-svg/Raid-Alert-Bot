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

## Run locally (Replit)
1. Set the secrets above in Replit's Secrets panel.
2. The "Raid Alert Bot" workflow runs `cd raid-alert-bot && npm run start`.
3. On first run, check logs for `CREDENTIALS_JSON=...` and `VAPID_KEYS_JSON=...`
   lines — save those as Replit secrets so restarts reuse them.

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
