/**
 * Sends Expo push notifications to Android app subscribers for a clan.
 *
 * When a raid is detected, this runs alongside the existing web-push sender
 * so both PWA subscribers and Android app subscribers receive the siren.
 */

import { db, nativePushSubscriptionsTable, clanMembersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { logger } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoMessage {
  to:       string;
  title:    string;
  body:     string;
  sound:    "default";
  channelId: string;
  priority: "high";
  data:     Record<string, unknown>;
}

interface ExpoTicket {
  status:  "ok" | "error";
  id?:     string;
  message?: string;
  details?: { error?: string };
}

export async function sendNativePushToClan(
  clanId: number,
  title:  string,
  body:   string,
): Promise<void> {
  // Only non-silenced members receive alerts
  const members = await db
    .select({ userId: clanMembersTable.userId })
    .from(clanMembersTable)
    .where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.silenced, false)));

  if (members.length === 0) return;

  const userIds = members.map((m) => m.userId);

  const subs = await db
    .select()
    .from(nativePushSubscriptionsTable)
    .where(
      and(
        eq(nativePushSubscriptionsTable.clanId, clanId),
        inArray(nativePushSubscriptionsTable.userId, userIds),
      ),
    );

  if (subs.length === 0) return;

  const messages: ExpoMessage[] = subs.map((s) => ({
    to:        s.expoToken,
    title,
    body,
    sound:     "default",
    channelId: "raid-alert",    // matches the channel in the Android app
    priority:  "high",
    data:      { clanId },
  }));

  // Expo allows up to 100 messages per batch
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body:    JSON.stringify(batch),
      });

      if (!res.ok) {
        logger.warn({ status: res.status }, "Expo push batch failed");
        continue;
      }

      const { data: tickets }: { data: ExpoTicket[] } = await res.json() as { data: ExpoTicket[] };

      // Remove stale tokens (DeviceNotRegistered)
      const staleTokens = tickets
        .map((t, idx) => (t.details?.error === "DeviceNotRegistered" ? batch[idx]?.to : null))
        .filter((t): t is string => !!t);

      if (staleTokens.length > 0) {
        await db
          .delete(nativePushSubscriptionsTable)
          .where(inArray(nativePushSubscriptionsTable.expoToken, staleTokens))
          .catch(() => {});
        logger.info({ count: staleTokens.length }, "Removed stale native push tokens");
      }
    } catch (err) {
      logger.warn({ err }, "Error sending native push batch");
    }
  }
}
