import webpush from "web-push";
import { db, pushSubscriptionsTable, clanMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";
import { sendNativePushToClan } from "./nativePush";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_CONTACT_EMAIL = process.env.VAPID_CONTACT_EMAIL ?? "admin@example.com";

let vapidConfigured = false;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      `mailto:${VAPID_CONTACT_EMAIL}`,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
    );
    vapidConfigured = true;
    logger.info("Web push VAPID configured");
  } catch (err) {
    logger.warn({ err }, "Invalid VAPID keys — web push notifications disabled");
  }
} else {
  logger.warn("VAPID keys not set — web push notifications disabled");
}

export function getVapidPublicKey(): string | null {
  return vapidConfigured ? (VAPID_PUBLIC_KEY ?? null) : null;
}

export async function sendPushToClан(
  clanId: number,
  title: string,
  body: string,
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  // Get all non-silenced subscribers for this clan
  const members = await db
    .select({ userId: clanMembersTable.userId, silenced: clanMembersTable.silenced })
    .from(clanMembersTable)
    .where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.silenced, false)));

  const userIds = members.map((m) => m.userId);
  if (userIds.length === 0) return;

  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.clanId, clanId));

  const activeSubs = subs.filter((s) => userIds.includes(s.userId));
  const payload = JSON.stringify({ title, body, clanId });

  await Promise.allSettled([
    // Web push (PWA subscribers)
    ...activeSubs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
        .catch((err) => {
          logger.warn({ err, endpoint: sub.endpoint }, "Web push notification failed");
        }),
    ),
    // Native push (Android app subscribers)
    sendNativePushToClan(clanId, title, body).catch((err) => {
      logger.warn({ err }, "Native push failed");
    }),
  ]);
}
