import { config } from "./config";
import { startPushListener, PushListenerHandle, RaidAlert } from "./pushListener";
import { postRaidAlert } from "./discord";
import { createHealthServer } from "./server";

let listenerHandle: PushListenerHandle | null = null;

async function handleAlert(alert: RaidAlert) {
  console.log("Raid alert received:", alert.title, "-", alert.body);
  try {
    await postRaidAlert(alert);
    console.log("Posted raid alert to Discord.");
  } catch (err) {
    console.error("Failed to post raid alert to Discord:", err);
  }
}

async function main() {
  // Health server starts first so uptime monitors get a response even while
  // the push listener is still (re)connecting.
  createHealthServer(() => listenerHandle);

  console.log(`Ping target configured as: ${config.pingTarget}`);

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
