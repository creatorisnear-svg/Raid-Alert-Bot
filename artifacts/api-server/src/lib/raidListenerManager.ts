import { db, alertLogTable, clansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { postChannelAlert } from "./discordBot";
import { sendPushToClан } from "./webPush";

// Minimal type for listener handles — the actual push-receiver package
// is in the raid-alert-bot workspace; here we manage lifecycle only.
interface ListenerHandle {
  stop: () => void;
}

const activeListeners = new Map<number, ListenerHandle>();

async function startClan(
  clanId: number,
  raidKey: string | null,
  kaosApiKey: string | null,
): Promise<void> {
  if (!raidKey || !kaosApiKey) {
    logger.info({ clanId }, "Skipping raid listener — no raid key or API key");
    return;
  }

  try {
    const { startPushListener } = await import("./pushListener.js");
    const handle = await startPushListener({
      clanId,
      raidKey,
      kaosApiKey,
      onAlert: async (title: string, body: string, serverId: string | null) => {
        try {
          const [clan] = await db.select().from(clansTable).where(eq(clansTable.id, clanId));
          if (!clan) return;

          await db.insert(alertLogTable).values({ clanId, title, body, serverId, isTest: false });

          const mention = clan.pingRole ? `<@&${clan.pingRole}> ` : "";
          const message = `${mention}🚨 **${title}**\n${body}`;
          if (clan.discordChannelId) {
            await postChannelAlert(clan.discordChannelId, message);
          }
          await sendPushToClан(clanId, title, body);
        } catch (err) {
          logger.error({ err, clanId }, "Error dispatching raid alert");
        }
      },
    });
    activeListeners.set(clanId, handle);
    logger.info({ clanId }, "Raid listener started");
  } catch (err) {
    logger.warn({ err, clanId }, "Raid listener not available (push-receiver not installed in api-server scope)");
  }
}

function stopClan(clanId: number): void {
  const handle = activeListeners.get(clanId);
  if (handle) {
    try { handle.stop(); } catch {}
    activeListeners.delete(clanId);
    logger.info({ clanId }, "Raid listener stopped");
  }
}

async function restartClan(
  clanId: number,
  raidKey: string | null,
  kaosApiKey: string | null,
): Promise<void> {
  stopClan(clanId);
  await startClan(clanId, raidKey, kaosApiKey);
}

async function startAll(): Promise<void> {
  const clans = await db.select().from(clansTable);
  await Promise.allSettled(
    clans
      .filter((c) => c.raidKey && c.kaosApiKey)
      .map((c) => startClan(c.id, c.raidKey, c.kaosApiKey)),
  );
  logger.info({ count: activeListeners.size }, "Raid listeners initialized");
}

export const raidListenerManager = { startClan, stopClan, restartClan, startAll };
