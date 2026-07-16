import { Router, type IRouter } from "express";
import { db, pushSubscriptionsTable, nativePushSubscriptionsTable, clanMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getVapidPublicKey } from "../lib/webPush";

const router: IRouter = Router();

router.post("/clans/:clanId/push-subscribe", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;
  const { endpoint, p256dh, auth } = req.body;

  if (!endpoint || !p256dh || !auth) {
    res.status(400).json({ error: "endpoint, p256dh, and auth are required" });
    return;
  }

  // Check is a member
  const [member] = await db
    .select()
    .from(clanMembersTable)
    .where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, userId)));
  if (!member) { res.status(403).json({ error: "Not a member of this clan" }); return; }

  // Upsert subscription (one per endpoint per clan)
  const existing = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(and(eq(pushSubscriptionsTable.clanId, clanId), eq(pushSubscriptionsTable.endpoint, endpoint)));

  if (existing.length === 0) {
    await db.insert(pushSubscriptionsTable).values({ clanId, userId, endpoint, p256dh, auth });
  }

  res.status(201).json({ success: true });
});

router.delete("/clans/:clanId/push-subscribe", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const { endpoint } = req.body;

  if (!endpoint) { res.status(400).json({ error: "endpoint is required" }); return; }

  await db
    .delete(pushSubscriptionsTable)
    .where(and(eq(pushSubscriptionsTable.clanId, clanId), eq(pushSubscriptionsTable.endpoint, endpoint)));

  res.sendStatus(204);
});

router.get("/clans/:clanId/push-vapid", async (req, res): Promise<void> => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    res.status(503).json({ error: "Push notifications not configured" });
    return;
  }
  res.json({ publicKey });
});

// ── Native (Expo / Android app) push subscriptions ───────────────────────────

router.post("/clans/:clanId/native-push-subscribe", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;
  const { token } = req.body as { token?: string };

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token is required" });
    return;
  }

  // Must be a clan member and not silenced to receive alerts
  const [member] = await db
    .select()
    .from(clanMembersTable)
    .where(and(eq(clanMembersTable.clanId, clanId), eq(clanMembersTable.userId, userId)));
  if (!member) { res.status(403).json({ error: "Not a member of this clan" }); return; }

  // Upsert — ignore duplicates
  await db
    .insert(nativePushSubscriptionsTable)
    .values({ clanId, userId, expoToken: token })
    .onConflictDoNothing();

  res.status(201).json({ success: true });
});

router.delete("/clans/:clanId/native-push-subscribe", requireAuth, async (req, res): Promise<void> => {
  const clanId = parseInt(Array.isArray(req.params.clanId) ? req.params.clanId[0] : req.params.clanId, 10);
  const userId = req.session.userId!;
  const { token } = req.body as { token?: string };

  if (!token) { res.status(400).json({ error: "token is required" }); return; }

  await db
    .delete(nativePushSubscriptionsTable)
    .where(
      and(
        eq(nativePushSubscriptionsTable.clanId, clanId),
        eq(nativePushSubscriptionsTable.userId, userId),
        eq(nativePushSubscriptionsTable.expoToken, token),
      ),
    );

  res.sendStatus(204);
});

export default router;
