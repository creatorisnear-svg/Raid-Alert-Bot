import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const inviteTokensTable = pgTable("invite_tokens", {
  id: serial("id").primaryKey(),
  clanId: integer("clan_id").notNull().unique(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InviteToken = typeof inviteTokensTable.$inferSelect;
