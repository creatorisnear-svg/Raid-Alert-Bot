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
  let isNewDevice = false;
  if (!creds) {
    creds = await registerNewDevice();
    isNewDevice = true;
  }

  if (isNewDevice) {
    await registerWithKaos(creds);
  }

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

  const instance = new PushReceiver(receiverConfig as never);

  instance.onNotification((n: unknown) => {
    lastEventAt = new Date();
    try {
      const envelope = n as { message?: { title?: string; body?: string; data?: Record<string, unknown> } };
      const message = envelope.message || {};
      onAlert({
        title: message.title || "Raid Alert!",
        body: message.body || "",
        data: message.data || {},
        raw: n,
      });
    } catch (err) {
      console.error("Failed to parse incoming push notification:", err, n);
    }
  });

  instance.on("ON_CONNECT", () => {
    connected = true;
    console.log("Connected to Google push infrastructure.");
  });
  instance.on("ON_DISCONNECT", () => {
    connected = false;
    console.warn("Disconnected from Google push infrastructure -- library will auto-retry.");
  });

  await instance.connect();
  console.log("Push listener ready -- waiting for raid alerts.");

  return {
    isConnected: () => connected,
    lastEventAt: () => lastEventAt,
  };
}
