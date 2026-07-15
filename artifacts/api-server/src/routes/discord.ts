import { Router, type IRouter } from "express";
import { db, clansTable, clanMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getGuildTextChannels, getGuildRoles, checkBotInGuild, createTextChannel } from "../lib/discordBot";

const router: IRouter = Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

// Bot invite URL for a specific clan — frontend calls this to get the link
router.get("/clans/:clanId/discord/invite-url", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;

  const [member] = await db
    .select()
    .from(clanMembersTable)
    .where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, userId)));
  if (!member || member.role !== "leader") { res.status(403).json({ error: "Leader access required" }); return; }

  if (!DISCORD_CLIENT_ID) { res.status(500).json({ error: "Discord not configured" }); return; }

  // Permissions: View Channels + Send Messages + Mention Everyone + Manage Channels
  const permissions = (1024 + 2048 + 131072 + 16).toString();
  const callbackUrl = `${APP_URL}/api/discord/bot-callback`;

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    scope: "bot",
    permissions,
    redirect_uri: callbackUrl,
    response_type: "code",
    state: String(clanId),
  });

  res.json({ url: `https://discord.com/oauth2/authorize?${params.toString()}` });
});

// Discord redirects here after the user adds the bot to their server
router.get("/discord/bot-callback", async (req, res): Promise<void> => {
  const { guild_id, state } = req.query;
  const clanId = parseInt(String(state ?? ""), 10);

  if (!guild_id || !clanId || isNaN(clanId)) {
    res.redirect(`${APP_URL}/dashboard?error=bot-callback-invalid`);
    return;
  }

  // Verify the session user is leader of this clan
  const userId = req.session?.userId;
  if (!userId) {
    res.redirect(`${APP_URL}/api/auth/discord?next=/clans/${clanId}/setup`);
    return;
  }

  const [member] = await db
    .select()
    .from(clanMembersTable)
    .where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, userId)));
  if (!member || member.role !== "leader") {
    res.redirect(`${APP_URL}/dashboard?error=not-leader`);
    return;
  }

  // Save guild_id to clan
  await db
    .update(clansTable)
    .set({ discordServerId: String(guild_id) })
    .where(eq(clansTable.id, clanId));

  res.redirect(`${APP_URL}/clans/${clanId}/setup?discord=connected`);
});

// Check whether the bot is currently in the clan's configured server
router.get("/clans/:clanId/discord/bot-status", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;

  const [member] = await db
    .select()
    .from(clanMembersTable)
    .where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, userId)));
  if (!member || member.role !== "leader") { res.status(403).json({ error: "Leader access required" }); return; }

  const [clan] = await db.select({ discordServerId: clansTable.discordServerId }).from(clansTable).where(eq(clansTable.id, clanId));
  if (!clan?.discordServerId) { res.json({ inGuild: false }); return; }

  const inGuild = await checkBotInGuild(clan.discordServerId);
  res.json({ inGuild });
});

// Create a #raid-alerts channel in the clan's Discord server
router.post("/clans/:clanId/discord/create-channel", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;

  const [member] = await db
    .select()
    .from(clanMembersTable)
    .where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, userId)));
  if (!member || member.role !== "leader") { res.status(403).json({ error: "Leader access required" }); return; }

  const [clan] = await db.select({ discordServerId: clansTable.discordServerId }).from(clansTable).where(eq(clansTable.id, clanId));
  if (!clan?.discordServerId) { res.status(400).json({ error: "Discord server not connected" }); return; }

  try {
    const channelName = req.body?.name ?? "raid-alerts";
    const channel = await createTextChannel(clan.discordServerId, channelName);

    // Auto-save the new channel as the clan's alert channel
    await db.update(clansTable).set({ discordChannelId: channel.id }).where(eq(clansTable.id, clanId));

    res.json({ id: channel.id, name: channel.name });
  } catch (err) {
    req.log.warn({ err }, "Failed to create Discord channel");
    res.status(400).json({ error: "Could not create channel — make sure the bot has Manage Channels permission" });
  }
});

// Existing: fetch text channels for a clan's Discord server
router.get("/clans/:clanId/discord/channels", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;

  const [member] = await db
    .select()
    .from(clanMembersTable)
    .where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, userId)));
  if (!member || member.role !== "leader") { res.status(403).json({ error: "Leader access required" }); return; }

  const [clan] = await db.select({ discordServerId: clansTable.discordServerId }).from(clansTable).where(eq(clansTable.id, clanId));
  if (!clan?.discordServerId) { res.status(400).json({ error: "Discord server not configured" }); return; }

  try {
    const channels = await getGuildTextChannels(clan.discordServerId);
    res.json(channels);
  } catch (err) {
    req.log.warn({ err }, "Failed to fetch Discord channels");
    res.status(400).json({ error: "Could not fetch channels — make sure the AVIV bot is in your server" });
  }
});

// Existing: fetch roles for a clan's Discord server
router.get("/clans/:clanId/discord/roles", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;

  const [member] = await db
    .select()
    .from(clanMembersTable)
    .where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, userId)));
  if (!member || member.role !== "leader") { res.status(403).json({ error: "Leader access required" }); return; }

  const [clan] = await db.select({ discordServerId: clansTable.discordServerId }).from(clansTable).where(eq(clansTable.id, clanId));
  if (!clan?.discordServerId) { res.status(400).json({ error: "Discord server not configured" }); return; }

  try {
    const roles = await getGuildRoles(clan.discordServerId);
    res.json(roles);
  } catch (err) {
    req.log.warn({ err }, "Failed to fetch Discord roles");
    res.status(400).json({ error: "Could not fetch roles — make sure the AVIV bot is in your server" });
  }
});

export default router;
