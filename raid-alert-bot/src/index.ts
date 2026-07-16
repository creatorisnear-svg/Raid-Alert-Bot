import { config } from "./config";
import { startPushListener, PushListenerHandle, RaidAlert } from "./pushListener";
import { postRaidAlert } from "./discord";
import { createHealthServer } from "./server";
import { loadOrCreateVapidKeys } from "./vapidStore";
import { initWebPush, pushAlertToSubscribers } from "./webPush";
import { pushNativeAlert } from "./expoPush";
import { upsertClan } from "./clanRegistryStore";

let listenerHandle: PushListenerHandle | null = null;

async function handleAlert(alert: RaidAlert) {
  console.log("Raid alert received:", alert.title, "-", alert.body);

  // Fire all three channels in parallel -- a failure in one doesn't block the others.
  const [discordResult, pushResult, nativeResult] = await Promise.allSettled([
    postRaidAlert(alert),
    pushAlertToSubscribers(alert),   // web-push to PWA subscribers
    pushNativeAlert(alert),          // Expo push to Android app subscribers
  ]);

  if (discordResult.status === "rejected") {
    console.error("Failed to post raid alert to Discord:", discordResult.reason);
  } else {
    console.log("Posted raid alert to Discord.");
  }

  if (pushResult.status === "rejected") {
    console.error("Failed to push raid alert to PWA subscribers:", pushResult.reason);
  }

  if (nativeResult.status === "rejected") {
    console.error("Failed to push raid alert to Android app subscribers:", nativeResult.reason);
  }
}

/** Register this bot in the clan registry (local + optional remote). */
async function selfRegister(): Promise<void> {
  if (!config.publicUrl) return;

  // Always write to the local registry — this makes the AVIV bot list itself.
  upsertClan({
    id: config.clanId,
    name: config.clanName,
    color: config.clanColor,
    botUrl: config.publicUrl,
  });
  console.log(`Registered self in local clan registry: ${config.clanName} (${config.clanId})`);

  // If a remote registry URL is set, register there too (for secondary clan bots).
  if (config.registryUrl && config.registryKey) {
    try {
      const res = await fetch(`${config.registryUrl}/api/register-clan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Registry-Key": config.registryKey,
        },
        body: JSON.stringify({
          id: config.clanId,
          name: config.clanName,
          color: config.clanColor,
          botUrl: config.publicUrl,
        }),
      });
      if (res.ok) {
        console.log(`Registered with clan registry at ${config.registryUrl}.`);
      } else {
        console.warn(`Failed to register with clan registry: ${res.status}`);
      }
    } catch (err) {
      console.warn("Could not reach clan registry (will retry on next restart):", err);
    }
  }
}

async function main() {
  const vapidKeys = loadOrCreateVapidKeys();
  initWebPush(vapidKeys);

  // Health server starts first so uptime monitors get a response even while
  // the push listener is still (re)connecting.
  createHealthServer(() => listenerHandle, vapidKeys);

  console.log(`Ping target configured as: ${config.pingTarget}`);
  console.log(`Clan app served for: ${config.clanName}`);

  // Non-blocking — a registry failure never stops the bot from starting.
  selfRegister().catch((err) => console.warn("Self-registration failed:", err));

  listenerHandle = await startPushListener(handleAlert);
}

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
