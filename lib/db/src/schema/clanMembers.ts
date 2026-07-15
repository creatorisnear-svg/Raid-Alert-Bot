import { pgTable, text, timestamp, boolean, integer, primaryKey } from "drizzle-orm/pg-core";

export const clanMembersTable = pgTable("clan_members", {
  clanId: integer("clan_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role", { enum: ["leader", "member"] }).notNull().default("member"),
  silenced: boolean("silenced").notNull().default(false),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.clanId, t.userId] }),
]);

export type ClanMember = typeof clanMembersTable.$inferSelect;
