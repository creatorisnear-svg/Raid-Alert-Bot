import { Router, type IRouter } from "express";
import { db, clansTable, clanMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getGuildTextChannels, getGuildRoles } from "../lib/discordBot";

const router: IRouter = Router();

router.get("/clans/:clanId/discord/channels", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;

  const [member] = await db
    .select()
    .from(clanMembersTable)
    .where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, userId)));
  if (!member || member.role !== "leader") { res.status(403).json({ error: "Leader access required" }); return; }

  const [clan] = await db.select({ discordServerId: clansTable.discordServerId }).from(clansTable).where(eq(clansTable.id, clanId));
  if (!clan?.discordServerId) { res.status(400).json({ error: "Discord server ID not configured for this clan" }); return; }

  try {
    const channels = await getGuildTextChannels(clan.discordServerId);
    res.json(channels);
  } catch (err) {
    req.log.warn({ err }, "Failed to fetch Discord channels");
    res.status(400).json({ error: "Could not fetch channels — make sure the AVIV bot is in your Discord server" });
  }
});

router.get("/clans/:clanId/discord/roles", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;

  const [member] = await db
    .select()
    .from(clanMembersTable)
    .where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, userId)));
  if (!member || member.role !== "leader") { res.status(403).json({ error: "Leader access required" }); return; }

  const [clan] = await db.select({ discordServerId: clansTable.discordServerId }).from(clansTable).where(eq(clansTable.id, clanId));
  if (!clan?.discordServerId) { res.status(400).json({ error: "Discord server ID not configured for this clan" }); return; }

  try {
    const roles = await getGuildRoles(clan.discordServerId);
    res.json(roles);
  } catch (err) {
    req.log.warn({ err }, "Failed to fetch Discord roles");
    res.status(400).json({ error: "Could not fetch roles — make sure the AVIV bot is in your Discord server" });
  }
});

export default router;
