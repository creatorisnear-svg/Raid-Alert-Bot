import { Router, type IRouter } from "express";
import { db, joinRequestsTable, clanMembersTable, clansTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

router.post("/clans/:clanId/join-requests", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;

  // Check not already a member
  const [existing] = await db
    .select()
    .from(clanMembersTable)
    .where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, userId)));
  if (existing) { res.status(409).json({ error: "Already a member of this clan" }); return; }

  // Check no pending request
  const [pendingReq] = await db
    .select()
    .from(joinRequestsTable)
    .where(and(eq(joinRequestsTable.clanId, clanId), eq(joinRequestsTable.userId, userId), eq(joinRequestsTable.status, "pending")));
  if (pendingReq) { res.status(409).json({ error: "Join request already pending" }); return; }

  const [request] = await db
    .insert(joinRequestsTable)
    .values({ clanId, userId })
    .returning();

  const [user] = await db.select({ username: usersTable.username, avatar: usersTable.avatar }).from(usersTable).where(eq(usersTable.id, userId));

  res.status(201).json({
    id: request.id,
    clanId: request.clanId,
    userId: request.userId,
    username: user?.username ?? "",
    avatar: user?.avatar ?? null,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
  });
});

router.get("/clans/:clanId/join-requests", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;

  const [clan] = await db.select({ leaderId: clansTable.leaderId }).from(clansTable).where(eq(clansTable.id, clanId));
  if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }
  if (clan.leaderId !== userId) { res.status(403).json({ error: "Only the clan leader can view join requests" }); return; }

  const requests = await db
    .select({
      id: joinRequestsTable.id,
      clanId: joinRequestsTable.clanId,
      userId: joinRequestsTable.userId,
      status: joinRequestsTable.status,
      createdAt: joinRequestsTable.createdAt,
      username: usersTable.username,
      avatar: usersTable.avatar,
    })
    .from(joinRequestsTable)
    .innerJoin(usersTable, eq(joinRequestsTable.userId, usersTable.id))
    .where(and(eq(joinRequestsTable.clanId, clanId), eq(joinRequestsTable.status, "pending")));

  res.json(requests.map((r) => ({ ...r, avatar: r.avatar ?? null, createdAt: r.createdAt.toISOString() })));
});

router.patch("/clans/:clanId/join-requests/:requestId", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const requestId = parseInt(Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId, 10);
  const userId = req.session.userId!;

  const [clan] = await db.select({ leaderId: clansTable.leaderId }).from(clansTable).where(eq(clansTable.id, clanId));
  if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }
  if (clan.leaderId !== userId) { res.status(403).json({ error: "Only the clan leader can resolve join requests" }); return; }

  const { action } = req.body;
  if (action !== "approve" && action !== "reject") { res.status(400).json({ error: "action must be approve or reject" }); return; }

  const [request] = await db.select().from(joinRequestsTable).where(eq(joinRequestsTable.id, requestId));
  if (!request) { res.status(404).json({ error: "Request not found" }); return; }

  const newStatus = action === "approve" ? "approved" : "rejected";
  const [updated] = await db
    .update(joinRequestsTable)
    .set({ status: newStatus })
    .where(eq(joinRequestsTable.id, requestId))
    .returning();

  if (action === "approve") {
    await db
      .insert(clanMembersTable)
      .values({ clanId, userId: request.userId, role: "member" })
      .onConflictDoNothing();
  }

  const [user] = await db.select({ username: usersTable.username, avatar: usersTable.avatar }).from(usersTable).where(eq(usersTable.id, request.userId));

  res.json({
    id: updated.id,
    clanId: updated.clanId,
    userId: updated.userId,
    username: user?.username ?? "",
    avatar: user?.avatar ?? null,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
