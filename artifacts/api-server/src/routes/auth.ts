import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET ?? "";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const REDIRECT_URI = `${APP_URL}/api/auth/discord/callback`;

router.get("/auth/discord", (req, res): void => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "identify",
    state: req.query.next ? String(req.query.next) : "/dashboard",
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

router.get("/auth/discord/callback", async (req, res): Promise<void> => {
  const { code, state } = req.query;

  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Missing code" });
    return;
  }

  try {
    // Exchange code for token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      req.log.error({ status: tokenRes.status }, "Discord token exchange failed");
      res.status(502).json({ error: "Discord authentication failed" });
      return;
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };

    // Fetch Discord user info
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      res.status(502).json({ error: "Failed to fetch Discord user info" });
      return;
    }

    const discordUser = (await userRes.json()) as {
      id: string;
      username: string;
      avatar: string | null;
      global_name: string | null;
    };

    const displayName = discordUser.global_name ?? discordUser.username;

    // Upsert user
    const [user] = await db
      .insert(usersTable)
      .values({
        discordId: discordUser.id,
        username: displayName,
        avatar: discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : null,
      })
      .onConflictDoUpdate({
        target: usersTable.discordId,
        set: {
          username: displayName,
          avatar: discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : null,
          updatedAt: new Date(),
        },
      })
      .returning();

    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve())),
    );

    const next = typeof state === "string" && state.startsWith("/") ? state : "/dashboard";
    const frontendBase = APP_URL.replace(/\/api$/, "");
    res.redirect(`${frontendBase}/aviv-clan-plus${next}`);
  } catch (err) {
    req.log.error({ err }, "Discord OAuth error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json({
    id: user.id,
    discordId: user.discordId,
    username: user.username,
    avatar: user.avatar ?? null,
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {});
  res.sendStatus(204);
});

export default router;
