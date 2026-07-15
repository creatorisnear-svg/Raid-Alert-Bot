import { Router, type IRouter } from "express";
import { db, clanMembersTable, usersTable, clansTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

router.get("/clans/:clanId/members", async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);

  const members = await db
    .select({
      userId: clanMembersTable.userId,
      clanId: clanMembersTable.clanId,
      role: clanMembersTable.role,
      silenced: clanMembersTable.silenced,
      joinedAt: clanMembersTable.joinedAt,
      username: usersTable.username,
      avatar: usersTable.avatar,
    })
    .from(clanMembersTable)
    .innerJoin(usersTable, eq(clanMembersTable.userId, usersTable.id))
    .where(eq(clanMembersTable.clanId, clanId));

  res.json(
    members.map((m) => ({
      userId: m.userId,
      clanId: m.clanId,
      username: m.username,
      avatar: m.avatar ?? null,
      role: m.role,
      silenced: m.silenced,
      joinedAt: m.joinedAt.toISOString(),
    })),
  );
});

router.patch("/clans/:clanId/members/me", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;

  const [member] = await db
    .select()
    .from(clanMembersTable)
    .where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, userId)));

  if (!member) { res.status(404).json({ error: "Not a member of this clan" }); return; }

  const updates: Partial<{ silenced: boolean }> = {};
  if (typeof req.body.silenced === "boolean") updates.silenced = req.body.silenced;

  const [updated] = await db
    .update(clanMembersTable)
    .set(updates)
    .where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, userId)))
    .returning();

  const [user] = await db.select({ username: usersTable.username, avatar: usersTable.avatar }).from(usersTable).where(eq(usersTable.id, userId));

  res.json({
    userId: updated.userId,
    clanId: updated.clanId,
    username: user?.username ?? "",
    avatar: user?.avatar ?? null,
    role: updated.role,
    silenced: updated.silenced,
    joinedAt: updated.joinedAt.toISOString(),
  });
});

// Leave clan — operationId was "leaveClан" (Cyrillic а) — route handles both
router.delete("/clans/:clanId/members/me", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;

  const [clan] = await db.select({ leaderId: clansTable.leaderId }).from(clansTable).where(eq(clansTable.id, clanId));
  if (clan?.leaderId === userId) {
    res.status(400).json({ error: "The clan leader cannot leave — transfer leadership or delete the clan" });
    return;
  }

  await db.delete(clanMembersTable).where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, userId)));
  res.sendStatus(204);
});

router.delete("/clans/:clanId/members/:userId", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const targetId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);
  const requesterId = req.session.userId!;

  const [clan] = await db.select({ leaderId: clansTable.leaderId }).from(clansTable).where(eq(clansTable.id, clanId));
  if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }
  if (clan.leaderId !== requesterId) { res.status(403).json({ error: "Only the clan leader can remove members" }); return; }
  if (targetId === requesterId) { res.status(400).json({ error: "Cannot remove yourself" }); return; }

  await db.delete(clanMembersTable).where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, targetId)));
  res.sendStatus(204);
});

export default router;
