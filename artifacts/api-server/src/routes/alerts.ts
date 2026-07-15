import { Router, type IRouter } from "express";
import { db, alertLogTable, clansTable, clanMembersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { postChannelAlert } from "../lib/discordBot";
import { sendPushToClан } from "../lib/webPush";

const router: IRouter = Router();

router.get("/clans/:clanId/alerts", async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);

  const [clan] = await db.select({ name: clansTable.name, isPrivate: clansTable.isPrivate }).from(clansTable).where(eq(clansTable.id, clanId));
  if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }

  // For private clans, only members can see alerts
  if (clan.isPrivate) {
    const userId = req.session?.userId;
    if (!userId) { res.status(403).json({ error: "Members only" }); return; }
    const [member] = await db.select().from(clanMembersTable).where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, userId)));
    if (!member) { res.status(403).json({ error: "Members only" }); return; }
  }

  const alerts = await db
    .select()
    .from(alertLogTable)
    .where(eq(alertLogTable.clanId, clanId))
    .orderBy(desc(alertLogTable.createdAt))
    .limit(50);

  res.json(
    alerts.map((a) => ({
      id: a.id,
      clanId: a.clanId,
      clanName: clan.name,
      title: a.title,
      body: a.body,
      serverId: a.serverId ?? null,
      isTest: a.isTest,
      createdAt: a.createdAt.toISOString(),
    })),
  );
});

router.post("/clans/:clanId/alerts/test", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;

  const [clan] = await db.select().from(clansTable).where(eq(clansTable.id, clanId));
  if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }
  if (clan.leaderId !== userId) { res.status(403).json({ error: "Leader only" }); return; }

  const title = `Test Alert — ${clan.name}`;
  const body = "This is a test raid alert from AVIV Clan+";

  // Post to Discord
  if (clan.discordChannelId) {
    const mention = clan.pingRole ? `<@&${clan.pingRole}> ` : "";
    await postChannelAlert(clan.discordChannelId, `${mention}🚨 **${title}**\n${body}`);
  }

  // Send web push
  await sendPushToClан(clanId, title, body);

  const [entry] = await db
    .insert(alertLogTable)
    .values({ clanId, title, body, isTest: true })
    .returning();

  res.json({
    id: entry.id,
    clanId: entry.clanId,
    clanName: clan.name,
    title: entry.title,
    body: entry.body,
    serverId: entry.serverId ?? null,
    isTest: entry.isTest,
    createdAt: entry.createdAt.toISOString(),
  });
});

export default router;
