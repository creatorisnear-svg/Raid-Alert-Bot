import { randomBytes } from "crypto";
import { db, mobileTokensTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function generateMobileToken(userId: number): Promise<string> {
  const token     = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await db.insert(mobileTokensTable).values({ token, userId, expiresAt });
  // Best-effort cleanup of expired tokens (non-blocking)
  db.delete(mobileTokensTable).where(lt(mobileTokensTable.expiresAt, new Date())).catch(() => {});
  return token;
}

export async function validateMobileToken(token: string): Promise<number | null> {
  const [row] = await db
    .select()
    .from(mobileTokensTable)
    .where(eq(mobileTokensTable.token, token));
  if (!row) return null;
  if (row.expiresAt < new Date()) return null;
  return row.userId;
}
