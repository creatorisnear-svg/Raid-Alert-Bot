/**
 * Sends raid-alert push notifications to Android app subscribers via
 * Expo's free push notification service (exp.host).
 *
 * How it works:
 *   1. The Android app registers with Expo's push service and receives an
 *      Expo push token (e.g. ExponentPushToken[xxxxxx]).
 *   2. The app sends that token to our /api/subscribe-native endpoint, which
 *      stores it in data/native-subscribers.json.
 *   3. On every raid alert, this module POSTs all stored tokens to the Expo
 *      push API in one batch request.
 *   4. Expo relays the notification to Android via FCM.
 *   5. Android displays the notification using the "raid-alert" channel
 *      (configured in the app), which has the custom siren.mp3 sound and
 *      max importance -- so the siren plays even when the screen is off.
 *
 * No account, no API key, and no extra npm package needed -- just fetch.
 * The Expo push API is free for all Expo apps with no usage limits.
 */

import { loadNativeSubscribers, removeNativeSubscriber } from "./nativeSubscribersStore";
import { RaidAlert } from "./pushListener";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  channelId: string;
  priority: "high";
  data?: Record<string, unknown>;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoPushResponse {
  data: ExpoPushTicket[];
}

export async function pushNativeAlert(alert: RaidAlert): Promise<void> {
  const tokens = loadNativeSubscribers();
  if (tokens.length === 0) {
    console.log("No native (Android app) subscribers -- skipping Expo push.");
    return;
  }

  const messages: ExpoPushMessage[] = tokens.map((token) => ({
    to: token,
    title: alert.title || "Raid Alert!",
    body: alert.body || "Your base is under attack!",
    // This channelId must match the channel created in the Android app
    // (setNotificationChannelAsync in app/index.tsx). The channel has
    // siren.mp3 as its sound, so Android plays the siren automatically.
    channelId: "raid-alert",
    priority: "high",
    data: { ...(alert.data as Record<string, unknown>) },
  }));

  console.log(`Sending Expo push to ${tokens.length} Android subscriber(s)...`);

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Expo push API error (${response.status}): ${text}`);
  }

  const result = (await response.json()) as ExpoPushResponse;

  // Check tickets -- remove tokens that are no longer valid.
  result.data.forEach((ticket, i) => {
    if (ticket.status === "error") {
      const errCode = ticket.details?.error;
      if (errCode === "DeviceNotRegistered" || errCode === "InvalidCredentials") {
        console.warn(`Removing stale native subscriber: ${tokens[i]}`);
        removeNativeSubscriber(tokens[i]);
      } else {
        console.error(
          `Expo push error for ${tokens[i]} (${errCode ?? "unknown"}):`,
          ticket.message
        );
      }
    }
  });

  const okCount = result.data.filter((t) => t.status === "ok").length;
  console.log(`Expo push delivered: ${okCount}/${tokens.length} accepted by Expo.`);
}
