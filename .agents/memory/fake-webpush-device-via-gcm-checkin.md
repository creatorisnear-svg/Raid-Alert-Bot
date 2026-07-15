---
name: Impersonating a browser Web Push subscription headlessly
description: How to register a real, Google-backed Web Push endpoint (fcm.googleapis.com/fcm/send/...) from a headless Node process, without a browser and without owning a Firebase project — for services that need to receive push notifications meant for a real device.
---

## The technique

A site using the plain browser Push API (VAPID-based, no Firebase SDK) can be
"impersonated" as a device without a browser:

1. Get the site's VAPID public key — it's meant to be public, normally embedded
   in the site's client-side JS wherever it calls
   `pushManager.subscribe({ applicationServerKey })`.
2. Run Google's **legacy Android/Chrome checkin + registration** flow
   (`android.clients.google.com/checkin` then `/c2dm/register3`) with
   `sender = <the site's VAPID key>` and device type `DEVICE_CHROME_BROWSER`.
   This returns a real `androidId` / `securityToken` / registration `token` —
   no Firebase project of your own is required for this step. The npm package
   `@eneris/push-receiver` implements this (its internal `gcm.js` module);
   its default export config already supports a `vapidKey` field for exactly
   this purpose, even though its README frames the library as Firebase-only.
3. Generate your own ECDH P-256 keypair + random auth secret locally (same as
   a real browser would for `p256dh`/`auth`) — no library involvement needed.
4. Register `https://fcm.googleapis.com/fcm/send/<token>` + your own
   `p256dh`/`auth` with the target site as if it were a real device/browser
   subscription.
5. Open a persistent MCS connection (`mtalk.google.com:5228`, TLS) using the
   `androidId`/`securityToken` from step 2 and log in. This works with
   **dummy** Firebase Installations values — the library's own stricter
   "re-register if credentials incomplete" check can be satisfied with
   placeholder `fcm.installation` data. Real pushes arrive here fully
   decrypted (the library handles RFC 8291 decryption using the keys from
   step 3).

**Why:** confirmed working in practice (July 2026) against a real third-party
push backend (KAOS+, a Rust game companion PWA) that had no public API. A
prior open-source attempt at the same underlying mechanism
(`nborrmann/gcmreverse`, aimed at a native Android app instead of a browser)
got permanently stuck at the checkin/registration step. Using the
browser/Chrome device-type + VAPID-as-sender path (rather than the native-app
Firebase-project path) got past that wall.

**Caveats:**
- Registering your listener as "the device" typically **replaces** whatever
  real device was registered before (only one slot per user/key in most such
  systems) — the real user stops getting push on their actual phone/browser
  until they re-subscribe.
- A backend accepting a registration request (200 OK) is not proof it will
  actually deliver — some backends validate endpoint format/reachability only
  at send time, silently failing sends to non-real endpoints. Only a
  real Google-issued token proves the path works end to end.
- This relies on undocumented, Google-internal protocol behavior (not a
  supported public API) — it can change without notice.
