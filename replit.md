# Rust Clan Raid Alert Bot

A Discord bot that detects in-game raid alerts (from the Rust console community
bot "KAOSBOT" / its companion PWA "KAOS+") and pings `@everyone` in the clan's
Discord with the raider's name and server number. Intended to be deployed to
Koyeb (not Replit deployments) once built.

## Background / why this is unusual

The user has no admin rights on the Discord server where KAOSBOT posts alerts,
so the normal approach (invite a bot, read the channel) isn't available yet.
Instead of waiting on that, we investigated reverse-engineering KAOS+'s private
push-notification pipeline directly. This document tracks what was found so a
future session doesn't have to re-derive it.

## How KAOS+ delivers raid alerts (reverse-engineered)

- KAOS+ (`bot-app.ka0s.uk`) is a PWA. When a user clicks "ENABLE ALERTS", the
  browser creates a standard Web Push subscription and POSTs it to
  `https://bot-app.ka0s.uk/api.php?endpoint=register-device`, authenticated via
  header `X-Api-Key` + cookie `raid_key=<user's personal key>`.
- Request body shape: `{ raid_key, device_token: { endpoint, expirationTime, keys: { p256dh, auth } } }`.
- KAOS's VAPID public key (safe to reuse, meant to be public) is embedded in
  `bot-app.ka0s.uk/index.php`: `BK1HQ_7Wrsb85NjJtQ9HlCAQ3KxUwlgUej4hEy7aTHoszHk913Pob27Q0JWz5y48wZVtY9vVPAmaevT0VXmd764`.
- The backend does **not** validate that `endpoint` is a real push service before
  accepting registration (a fake webhook.site URL was accepted with `success:true`)
  — but it silently fails to actually *send* to non-real endpoints (confirmed:
  "failed to send test notification", zero requests logged at the fake catcher).
  So registration succeeding is not proof delivery will work — only a real,
  Google-issued endpoint receives real traffic.
- Their service worker (`sw.js`) uses the plain browser Push API directly — no
  Firebase SDK, no Firebase project config to extract. The `fcm.googleapis.com`
  address seen in real subscriptions is just Chrome's internal push transport,
  not evidence of a KAOS-owned Firebase project.

## Path A (in progress): headless "fake device" push receiver

Goal: register our own server as the KAOS+ "device" so Google delivers real
raid-alert pushes straight to our backend, decrypted, with no browser involved.

**Status: proof of concept working as of 2026-07-15.** Confirmed end-to-end:
1. Using the `@eneris/push-receiver` npm package's internal `gcm.js` module, ran
   Google's legacy Android/Chrome checkin + registration flow
   (`android.clients.google.com/checkin` then `/c2dm/register3`) with
   `sender = KAOS's VAPID key` and device type `DEVICE_CHROME_BROWSER`. This
   returned a **real, valid** Google registration token/androidId/securityToken
   — no Firebase project of our own was needed for this step.
2. Generated our own local ECDH P-256 keypair + auth secret (same as what a
   real browser would generate for a Web Push subscription).
3. Registered `https://fcm.googleapis.com/fcm/send/<token>` + our p256dh/auth
   as the device with KAOS's `register-device` endpoint — accepted.
4. Opened a persistent MCS connection (`mtalk.google.com:5228`) with the
   `androidId`/`securityToken` from step 1 and logged in successfully — this
   is the channel Google will use to push real messages to us. Confirmed the
   library's MCS login does **not** require the Firebase Installations API at
   all (dummy installation values work fine), so no real Firebase project is
   needed anywhere in this flow.
5. Live test (clicking "TEST RAID ALERT" in KAOS+) was triggered; awaiting
   confirmation of message arrival + decryption in this session.

**Known trade-off:** registering our listener as the device overwrites the
user's real KAOS+ device slot — their phone stops getting real push alerts
until they reopen KAOS+ and click "ENABLE ALERTS" again.

**Why this was attempted despite the risk:** a prior open-source reverse-engineering
project aimed at exactly this mechanism (`nborrmann/gcmreverse`) got stuck at
this same checkin/registration step and never finished it. We got further,
likely because we used the Chrome-browser checkin device type + VAPID-as-sender
flow, rather than the native-Android-app flow they were attempting.

## Path B (fallback, not started): Discord-channel-reading bot

Simpler and more robust: a bot invited to the clan's Discord server that reads
KAOSBOT's own raid-alert messages and reposts with `@everyone`. Needs a clan
admin to do a one-time bot invite. Not yet built — user chose to pursue Path A
first.

## Run & Operate

Nothing productionized yet — current work lives in a scratch script at
`/tmp/pushtest` (outside the repo, not committed) used to validate feasibility.
Once Path A (or B) is confirmed working, the real bot service still needs to be
built as a proper package and prepared for Koyeb deployment.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9 (template defaults — not yet
  applied to the raid-alert bot, which isn't part of the monorepo packages yet)
- API: Express 5 / DB: PostgreSQL + Drizzle ORM (template defaults, unused so far)

## Architecture decisions

- Chose to attempt direct push-interception (Path A) over the simpler
  Discord-channel-reading bot (Path B) at the user's explicit request, despite
  being warned Path A requires reverse-engineering undocumented behavior with
  no guaranteed success.
- Real device registration on the user's raid key gets overwritten every time
  we test Path A — user must re-enable real alerts afterward each time.

## Product

Not yet built. Planning/feasibility stage: confirming whether raid alerts can
be intercepted directly (Path A) before building the actual Discord-posting
bot and deciding final architecture.

## User preferences

- Final deployment target is **Koyeb**, not Replit deployments.
- Alert message should ping `@everyone` (or a role) with a message like
  "@everyone we are being raided" including the player name and server number.
- Secrets (`raid_key`, `X-Api-Key`, Discord bot token) must go through Replit's
  environment-secrets storage when the real service is built — never hardcoded.
- User explicitly wants to keep pursuing Path A even after being told it's a
  higher-risk, higher-effort path with no existing tooling precedent.

## Gotchas

- Every time we register a fake/test device with KAOS's raid key, it overwrites
  the user's real device — remind them to reopen KAOS+ and click "ENABLE ALERTS"
  to restore real notifications after each test.
- KAOS's `register-device` endpoint accepts (200 OK) endpoints it will never
  actually deliver to — a successful registration response is not proof the
  push will arrive. Only a real Google-issued FCM token proves the path works.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
