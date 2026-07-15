import { Router, type IRouter } from "express";
import { db, clansTable, clanMembersTable, alertLogTable, joinRequestsTable, usersTable } from "@workspace/db";
import { eq, and, count, max, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

router.get("/me/clans", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const memberships = await db
    .select()
    .from(clanMembersTable)
    .innerJoin(clansTable, eq(clanMembersTable.clanId, clansTable.id))
    .where(eq(clanMembersTable.userId, userId));

  const results = await Promise.all(
    memberships.map(async (m) => {
      const clan = m.clans;
      const member = m.clan_members;

      const [{ mc }] = await db
        .select({ mc: count() })
        .from(clanMembersTable)
        .where(eq(clanMembersTable.clanId, clan.id));

      const [{ ac }] = await db
        .select({ ac: count() })
        .from(alertLogTable)
        .where(eq(alertLogTable.clanId, clan.id));

      const [latestAlert] = await db
        .select({ createdAt: alertLogTable.createdAt })
        .from(alertLogTable)
        .where(and(eq(alertLogTable.clanId, clan.id), eq(alertLogTable.isTest, false)))
        .orderBy(desc(alertLogTable.createdAt))
        .limit(1);

      const [{ prc }] = await db
        .select({ prc: count() })
        .from(joinRequestsTable)
        .where(and(eq(joinRequestsTable.clanId, clan.id), eq(joinRequestsTable.status, "pending")));

      return {
        id: clan.id,
        name: clan.name,
        imageUrl: clan.imageUrl ?? null,
        role: member.role,
        silenced: member.silenced,
        memberCount: Number(mc),
        pendingRequestCount: member.role === "leader" ? Number(prc) : 0,
        lastAlertAt: latestAlert?.createdAt?.toISOString() ?? null,
        alertCount: Number(ac),
        hasRaidKey: !!clan.raidKey,
        discordConfigured: !!(clan.discordChannelId || clan.discordServerId),
      };
    }),
  );

  res.json(results);
});

router.get("/me/dashboard", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const memberships = await db
    .select({ clanId: clanMembersTable.clanId })
    .from(clanMembersTable)
    .where(eq(clanMembersTable.userId, userId));

  const clanIds = memberships.map((m) => m.clanId);

  const totalClans = clanIds.length;

  let totalAlerts = 0;
  let recentAlerts: object[] = [];
  let pendingRequests = 0;

  if (clanIds.length > 0) {
    // Count total alerts across all clans
    for (const clanId of clanIds) {
      const [{ ac }] = await db.select({ ac: count() }).from(alertLogTable).where(eq(alertLogTable.clanId, clanId));
      totalAlerts += Number(ac);
    }

    // Recent alerts across all clans
    const alerts = await db
      .select({
        id: alertLogTable.id,
        clanId: alertLogTable.clanId,
        clanName: clansTable.name,
        title: alertLogTable.title,
        body: alertLogTable.body,
        serverId: alertLogTable.serverId,
        isTest: alertLogTable.isTest,
        createdAt: alertLogTable.createdAt,
      })
      .from(alertLogTable)
      .innerJoin(clansTable, eq(alertLogTable.clanId, clansTable.id))
      .orderBy(desc(alertLogTable.createdAt))
      .limit(10);

    recentAlerts = alerts
      .filter((a) => clanIds.includes(a.clanId))
      .map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      }));

    // Pending requests in clans where user is leader
    const leaderMemberships = await db
      .select({ clanId: clanMembersTable.clanId })
      .from(clanMembersTable)
      .where(and(eq(clanMembersTable.userId, userId), eq(clanMembersTable.role, "leader")));

    for (const { clanId } of leaderMemberships) {
      const [{ prc }] = await db
        .select({ prc: count() })
        .from(joinRequestsTable)
        .where(and(eq(joinRequestsTable.clanId, clanId), eq(joinRequestsTable.status, "pending")));
      pendingRequests += Number(prc);
    }
  }

  res.json({ totalClans, totalAlerts, recentAlerts, pendingRequests });
});

export default router;
