import { PushReceiver } from "@eneris/push-receiver";
// These are internal modules (not part of the package's public API surface),
// but the package has no "exports" restriction and they're exactly what
// implements the legacy Google checkin/registration flow we need. See
// .agents/memory/fake-webpush-device-via-gcm-checkin.md for why this works.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const gcmModule = require("@eneris/push-receiver/dist/gcm.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const generateKeys = require("@eneris/push-receiver/dist/keys.js")
  .default as () => Promise<{
  publicKey: Buffer;
  privateKey: Buffer;
  authSecret: Buffer;
}>;

import {
  config,
  KAOS_VAPID_PUBLIC_KEY,
  KAOS_REGISTER_DEVICE_URL,
} from "./config";
import {
  loadCredentials,
  saveCredentials,
  StoredCredentials,
} from "./credentialsStore";

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function registerNewDevice(): Promise<StoredCredentials> {
  console.log("No stored push credentials found -- registering a new device with Google...");
  const gcmConfig = {
    bundleId: "receiver.push.com",
    chromeId: "org.chromium.linux",
    chromeVersion: "94.0.4606.51",
    vapidKey: KAOS_VAPID_PUBLIC_KEY,
  };
  const gcm = await gcmModule.default(gcmConfig);
  const keys = await generateKeys();

  const creds: StoredCredentials = {
    gcm,
    keys: {
      publicKey: keys.publicKey.toString("base64"),
      privateKey: keys.privateKey.toString("base64"),
      authSecret: keys.authSecret.toString("base64"),
    },
  };
  saveCredentials(creds);
  return creds;
}

async function registerWithKaos(creds: StoredCredentials): Promise<void> {
  const publicKey = Buffer.from(creds.keys.publicKey, "base64");
  const authSecret = Buffer.from(creds.keys.authSecret, "base64");

  const response = await fetch(KAOS_REGISTER_DEVICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": config.kaosApiKey,
      Cookie: `raid_key=${config.raidKey}`,
    },
    body: JSON.stringify({
      raid_key: config.raidKey,
      device_token: {
        endpoint: `https://fcm.googleapis.com/fcm/send/${creds.gcm.token}`,
        expirationTime: null,
        keys: {
          p256dh: base64url(publicKey),
          auth: base64url(authSecret),
        },
      },
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `KAOS register-device failed (${response.status}): ${text}`
    );
  }
  console.log("Registered with KAOS as the active raid-alert device:", text);
  console.log(
    "Note: this replaces whatever device (e.g. your phone) was previously " +
      "registered to this raid key -- re-open KAOS+ and tap ENABLE ALERTS " +
      "there if you also want phone notifications."
  );
}

export interface RaidAlert {
  title: string;
  body: string;
  data: Record<string, unknown>;
  raw: unknown;
}

export interface PushListenerHandle {
  isConnected: () => boolean;
  lastEventAt: () => Date | null;
}

export async function startPushListener(
  onAlert: (alert: RaidAlert) => void
): Promise<PushListenerHandle> {
  let creds = loadCredentials();
  if (!creds) {
    creds = await registerNewDevice();
  }

  // Always re-register with KAOS on startup, even if we have stored
  // credentials. KAOS only supports one registered device per raid key, so
  // if the user re-enabled alerts on their phone since the last restart,
  // KAOS is now pointing at the phone and the bot receives nothing. Claiming
  // the slot on every startup ensures the bot stays as the active device.
  await registerWithKaos(creds);

  const keys = {
    publicKey: Buffer.from(creds.keys.publicKey, "base64"),
    privateKey: Buffer.from(creds.keys.privateKey, "base64"),
    authSecret: Buffer.from(creds.keys.authSecret, "base64"),
  };

  const receiverConfig = {
    bundleId: "receiver.push.com",
    chromeId: "org.chromium.linux",
    chromeVersion: "94.0.4606.51",
    vapidKey: KAOS_VAPID_PUBLIC_KEY,
    // Dummy Firebase project -- only used by this library's stricter
    // "should I re-register" check, never actually contacted, since we
    // pre-seed full credentials below (see memory topic file for why this
    // is safe: MCS login only needs androidId/securityToken).
    firebase: {
      projectId: "dummy",
      appId: "dummy",
      apiKey: "dummy",
      messagingSenderId: "dummy",
    },
    credentials: {
      gcm: creds.gcm,
      keys,
      fcm: { installation: { token: "dummy", fid: "dummy" } },
      config: {
        bundleId: "receiver.push.com",
        projectId: "dummy",
        vapidKey: KAOS_VAPID_PUBLIC_KEY,
      },
    },
  };

  let connected = false;
  let lastEventAt: Date | null = null;
  let lastActivityAt: Date = new Date();

  // Record startup time so we can discard alerts Google replays from before
  // this process started. Google's MCS queues unacknowledged messages and
  // re-delivers the full backlog on every new connection, so without this
  // every redeploy would re-post every historical alert.
  const startupTime = Date.now();

  // Within a single session, also deduplicate by alert timestamp -- KAOS
  // sends two near-identical pushes per event (different persistentIds,
  // same data.timestamp). Keep only the first one we see.
  const seenAlertTimestamps = new Set<number>();

  const instance = new PushReceiver(receiverConfig as never);

  // Any protocol-level activity (heartbeat or message) proves the socket is
  // actually alive end-to-end -- used for the watchdog below, since real
  // raid alerts can be hours/days apart and we can't rely on them alone to
  // notice a silently-dead connection.
  const markActivity = () => {
    lastActivityAt = new Date();
  };

  // Logs every raw push the socket receives, even ones that don't look like
  // a raid alert, so we can tell "connection is dead" apart from "connection
  // is alive but KAOS never sent anything" when debugging missed alerts.
  instance.onNotification((n: unknown) => {
    markActivity();
    console.log("Raw push notification received:", JSON.stringify(n));

    const envelope = n as {
      persistentId?: string;
      message?: {
        title?: string;
        body?: string;
        data?: Record<string, unknown>;
      };
    };

    const message = envelope.message || {};
    const data = (message.data || {}) as Record<string, unknown>;

    // 1. Drop anything sent before this process started -- Google replays the
    //    full unacknowledged backlog on every new MCS connection, so every
    //    redeploy would otherwise re-post every historical alert.
    //    data.timestamp is a Unix timestamp in seconds from KAOS.
    const alertTimestampMs =
      typeof data.timestamp === "number" ? data.timestamp * 1000 : null;
    if (alertTimestampMs !== null && alertTimestampMs < startupTime) {
      console.log(
        `Skipping stale push (sent ${Math.round((startupTime - alertTimestampMs) / 1000)}s before startup): ${message.title}`
      );
      return;
    }

    // 2. Deduplicate within this session by alert timestamp -- KAOS sends two
    //    near-identical pushes per event with different persistentIds but the
    //    same data.timestamp. Only forward the first one.
    if (alertTimestampMs !== null) {
      if (seenAlertTimestamps.has(alertTimestampMs)) {
        console.log(`Skipping duplicate push (timestamp already forwarded): ${alertTimestampMs}`);
        return;
      }
      seenAlertTimestamps.add(alertTimestampMs);
      // Prevent unbounded growth -- keep only the last 200 alert timestamps.
      if (seenAlertTimestamps.size > 200) {
        const first = seenAlertTimestamps.values().next().value;
        if (first !== undefined) seenAlertTimestamps.delete(first);
      }
    }

    lastEventAt = new Date();
    try {
      onAlert({
        title: message.title || "Raid Alert!",
        body: message.body || "",
        data,
        raw: n,
      });
    } catch (err) {
      console.error("Failed to parse incoming push notification:", err, n);
    }
  });

  instance.on("ON_CONNECT", () => {
    connected = true;
    markActivity();
    console.log(`[${new Date().toISOString()}] Connected to Google push infrastructure.`);
  });
  instance.on("ON_DISCONNECT", () => {
    connected = false;
    console.warn(`[${new Date().toISOString()}] Disconnected from Google push infrastructure -- library will auto-retry.`);
  });
  instance.on("ON_HEARTBEAT", () => {
    markActivity();
    console.log(`[${new Date().toISOString()}] Heartbeat OK (connection alive).`);
  });
  instance.on("ON_READY", () => {
    markActivity();
    console.log(`[${new Date().toISOString()}] Push receiver ready.`);
  });

  await instance.connect();
  console.log("Push listener ready -- waiting for raid alerts.");

  // Watchdog: the library's own heartbeat should catch a dead socket within
  // ~10 minutes (5 min interval x2) and auto-reconnect, but if that ever
  // fails silently (e.g. Koyeb's network layer drops an idle TCP connection
  // without either side seeing a close event), force a hard reconnect
  // ourselves rather than sitting there marked "connected" while actually
  // deaf to incoming alerts.
  const WATCHDOG_STALE_MS = 15 * 60 * 1000;
  setInterval(() => {
    const staleMs = Date.now() - lastActivityAt.getTime();
    if (staleMs > WATCHDOG_STALE_MS) {
      console.warn(
        `[${new Date().toISOString()}] Watchdog: no socket activity for ${Math.round(staleMs / 1000)}s -- forcing reconnect.`
      );
      connected = false;
      markActivity();
      instance.connect().catch((err: unknown) => {
        console.error("Watchdog reconnect attempt failed:", err);
      });
    }
  }, 5 * 60 * 1000);

  return {
    isConnected: () => connected,
    lastEventAt: () => lastEventAt,
  };
}
