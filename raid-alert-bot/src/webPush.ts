import webpush from "web-push";
import { config } from "./config";
import { VapidKeys } from "./vapidStore";
import { loadSubscribers, removeSubscriberByEndpoint } from "./subscribersStore";
import { RaidAlert } from "./pushListener";

export function initWebPush(keys: VapidKeys): void {
  webpush.setVapidDetails(config.vapidContactEmail, keys.publicKey, keys.privateKey);
}

/**
 * Sends the raid alert to every clan member's installed app via Web Push.
 * The service worker (public/sw.js) turns this payload into a system
 * notification and, if the app happens to be open in a tab, also plays the
 * loud siren sound directly.
 */
export async function pushAlertToSubscribers(alert: RaidAlert): Promise<void> {
  const subs = loadSubscribers();
  if (subs.length === 0) {
    return;
  }

  const payload = JSON.stringify({
    title: alert.title || "Raid Alert!",
    body: alert.body || "Check Discord for details.",
    playSiren: true,
  });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired or was revoked by the browser -- drop it.
          removeSubscriberByEndpoint(sub.endpoint);
          console.log("Removed expired push subscription:", sub.endpoint);
        } else {
          console.error("Failed to push alert to a subscriber:", err);
        }
      }
    })
  );
  console.log(`Pushed raid alert to ${subs.length} subscriber(s).`);
}
