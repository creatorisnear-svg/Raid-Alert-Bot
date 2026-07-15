import { Router, type IRouter } from "express";
import { db, inviteTokensTable, clansTable, clanMembersTable, usersTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { randomBytes } from "crypto";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

function makeInviteUrl(token: string): string {
  const base = APP_URL.replace(/\/api$/, "");
  return `${base}/invite/${token}`;
}

router.get("/clans/:clanId/invite-token", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;

  const [clan] = await db.select({ leaderId: clansTable.leaderId }).from(clansTable).where(eq(clansTable.id, clanId));
  if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }
  if (clan.leaderId !== userId) { res.status(403).json({ error: "Only the clan leader can manage invite links" }); return; }

  let [invite] = await db.select().from(inviteTokensTable).where(eq(inviteTokensTable.clanId, clanId));
  if (!invite) {
    [invite] = await db.insert(inviteTokensTable).values({ clanId, token: randomBytes(16).toString("hex") }).returning();
  }

  res.json({ token: invite.token, url: makeInviteUrl(invite.token) });
});

router.post("/clans/:clanId/invite-token", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;

  const [clan] = await db.select({ leaderId: clansTable.leaderId }).from(clansTable).where(eq(clansTable.id, clanId));
  if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }
  if (clan.leaderId !== userId) { res.status(403).json({ error: "Only the clan leader can regenerate invite links" }); return; }

  const newToken = randomBytes(16).toString("hex");
  const [existing] = await db.select().from(inviteTokensTable).where(eq(inviteTokensTable.clanId, clanId));

  let invite;
  if (existing) {
    [invite] = await db.update(inviteTokensTable).set({ token: newToken }).where(eq(inviteTokensTable.clanId, clanId)).returning();
  } else {
    [invite] = await db.insert(inviteTokensTable).values({ clanId, token: newToken }).returning();
  }

  res.json({ token: invite.token, url: makeInviteUrl(invite.token) });
});

router.get("/invite/:token", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [invite] = await db.select().from(inviteTokensTable).where(eq(inviteTokensTable.token, token));
  if (!invite) { res.status(404).json({ error: "Invalid invite link" }); return; }

  const [clan] = await db.select().from(clansTable).where(eq(clansTable.id, invite.clanId));
  if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }

  const [leader] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, clan.leaderId));
  const [{ mc }] = await db.select({ mc: count() }).from(clanMembersTable).where(eq(clanMembersTable.clanId, clan.id));

  res.json({
    clanId: clan.id,
    name: clan.name,
    imageUrl: clan.imageUrl ?? null,
    memberCount: Number(mc),
    leaderUsername: leader?.username ?? "",
  });
});

router.post("/invite/:token/join", requireAuth, async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const userId = req.session.userId!;

  const [invite] = await db.select().from(inviteTokensTable).where(eq(inviteTokensTable.token, token));
  if (!invite) { res.status(404).json({ error: "Invalid invite link" }); return; }

  const [existing] = await db
    .select()
    .from(clanMembersTable)
    .where(and(eq(clanMembersTable.clanId, invite.clanId), eq(clanMembersTable.userId, userId)));
  if (existing) { res.status(409).json({ error: "Already a member of this clan" }); return; }

  const [member] = await db
    .insert(clanMembersTable)
    .values({ clanId: invite.clanId, userId, role: "member" })
    .returning();

  const [user] = await db.select({ username: usersTable.username, avatar: usersTable.avatar }).from(usersTable).where(eq(usersTable.id, userId));

  res.json({
    userId: member.userId,
    clanId: member.clanId,
    username: user?.username ?? "",
    avatar: user?.avatar ?? null,
    role: member.role,
    silenced: member.silenced,
    joinedAt: member.joinedAt.toISOString(),
  });
});

export default router;
