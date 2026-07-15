import { Router, type IRouter } from "express";
import { db, clansTable, clanMembersTable, alertLogTable, usersTable } from "@workspace/db";
import { eq, and, count, desc, ilike } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { raidListenerManager } from "../lib/raidListenerManager";

const router: IRouter = Router();

router.get("/clans", async (req, res): Promise<void> => {
  const q = req.query.q ? String(req.query.q) : null;
  const userId = req.session?.userId ?? null;

  let query = db
    .select({
      id: clansTable.id,
      name: clansTable.name,
      imageUrl: clansTable.imageUrl,
      isPrivate: clansTable.isPrivate,
    })
    .from(clansTable)
    .where(eq(clansTable.isPrivate, false))
    .$dynamic();

  if (q) {
    query = query.where(and(eq(clansTable.isPrivate, false), ilike(clansTable.name, `%${q}%`)));
  }

  const clans = await query.limit(30);

  const results = await Promise.all(
    clans.map(async (clan) => {
      const [{ mc }] = await db.select({ mc: count() }).from(clanMembersTable).where(eq(clanMembersTable.clanId, clan.id));
      const [{ ac }] = await db.select({ ac: count() }).from(alertLogTable).where(eq(alertLogTable.clanId, clan.id));
      return {
        id: clan.id,
        name: clan.name,
        imageUrl: clan.imageUrl ?? null,
        isPrivate: clan.isPrivate,
        memberCount: Number(mc),
        alertCount: Number(ac),
      };
    }),
  );

  res.json(results);
});

router.post("/clans", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { name, imageUrl, isPrivate } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Clan name is required" });
    return;
  }

  const [clan] = await db
    .insert(clansTable)
    .values({
      name: name.trim().slice(0, 40),
      imageUrl: imageUrl ?? null,
      isPrivate: isPrivate ?? false,
      leaderId: userId,
    })
    .returning();

  // Add leader as member
  await db.insert(clanMembersTable).values({ clanId: clan.id, userId, role: "leader" });

  const [leader] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId));

  res.status(201).json({
    ...buildClanResponse(clan, leader?.username ?? "", 1, 0, null, "leader", false),
  });
});

router.get("/clans/:clanId", async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  if (isNaN(clanId)) { res.status(400).json({ error: "Invalid clan ID" }); return; }
  const userId = req.session?.userId ?? null;

  const [clan] = await db.select().from(clansTable).where(eq(clansTable.id, clanId));
  if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }

  const [leader] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, clan.leaderId));
  const [{ mc }] = await db.select({ mc: count() }).from(clanMembersTable).where(eq(clanMembersTable.clanId, clanId));
  const [{ ac }] = await db.select({ ac: count() }).from(alertLogTable).where(eq(alertLogTable.clanId, clanId));
  const [latestAlert] = await db
    .select({ createdAt: alertLogTable.createdAt })
    .from(alertLogTable)
    .where(and(eq(alertLogTable.clanId, clanId), eq(alertLogTable.isTest, false)))
    .orderBy(desc(alertLogTable.createdAt))
    .limit(1);

  let myRole: string | null = null;
  let isSilenced = false;
  if (userId) {
    const [mem] = await db
      .select()
      .from(clanMembersTable)
      .where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, userId)));
    if (mem) { myRole = mem.role; isSilenced = mem.silenced; }
  }

  // Private clans only visible to members
  if (clan.isPrivate && !myRole) {
    res.status(404).json({ error: "Clan not found" });
    return;
  }

  res.json(buildClanResponse(
    clan,
    leader?.username ?? "",
    Number(mc),
    Number(ac),
    latestAlert?.createdAt?.toISOString() ?? null,
    myRole,
    isSilenced,
  ));
});

router.patch("/clans/:clanId", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;

  const [clan] = await db.select().from(clansTable).where(eq(clansTable.id, clanId));
  if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }
  if (clan.leaderId !== userId) { res.status(403).json({ error: "Only the clan leader can update settings" }); return; }

  const allowed = ["name", "imageUrl", "isPrivate", "raidKey", "kaosApiKey", "discordServerId", "discordChannelId", "discordChannelName", "pingRole"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const hadRaidKey = !!clan.raidKey;
  const [updated] = await db.update(clansTable).set(updates as Partial<typeof clan>).where(eq(clansTable.id, clanId)).returning();

  // If raid key changed, restart listener
  if (updates.raidKey !== undefined || updates.kaosApiKey !== undefined) {
    raidListenerManager.restartClan(clanId, updated.raidKey, updated.kaosApiKey).catch(() => {});
  }

  const [leader] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, clan.leaderId));
  const [{ mc }] = await db.select({ mc: count() }).from(clanMembersTable).where(eq(clanMembersTable.clanId, clanId));
  const [{ ac }] = await db.select({ ac: count() }).from(alertLogTable).where(eq(alertLogTable.clanId, clanId));

  res.json(buildClanResponse(updated, leader?.username ?? "", Number(mc), Number(ac), null, "leader", false));
});

router.delete("/clans/:clanId", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;

  const [clan] = await db.select().from(clansTable).where(eq(clansTable.id, clanId));
  if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }
  if (clan.leaderId !== userId) { res.status(403).json({ error: "Only the clan leader can delete the clan" }); return; }

  raidListenerManager.stopClan(clanId);
  await db.delete(clansTable).where(eq(clansTable.id, clanId));
  res.sendStatus(204);
});

function buildClanResponse(
  clan: { id: number; name: string; imageUrl: string | null; leaderId: number; isPrivate: boolean; discordServerId: string | null; discordChannelId: string | null; discordChannelName: string | null; pingRole: string; raidKey: string | null; createdAt: Date },
  leaderUsername: string,
  memberCount: number,
  alertCount: number,
  lastAlertAt: string | null,
  myRole: string | null,
  isSilenced: boolean,
) {
  return {
    id: clan.id,
    name: clan.name,
    imageUrl: clan.imageUrl ?? null,
    leaderId: clan.leaderId,
    leaderUsername,
    isPrivate: clan.isPrivate,
    discordServerId: clan.discordServerId ?? null,
    discordChannelId: clan.discordChannelId ?? null,
    discordChannelName: clan.discordChannelName ?? null,
    pingRole: clan.pingRole,
    memberCount,
    alertCount,
    lastAlertAt,
    myRole,
    isSilenced,
    hasRaidKey: !!clan.raidKey,
    createdAt: clan.createdAt.toISOString(),
  };
}

export default router;
