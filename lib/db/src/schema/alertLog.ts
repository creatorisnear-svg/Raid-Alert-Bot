import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const alertLogTable = pgTable("alert_log", {
  id: serial("id").primaryKey(),
  clanId: integer("clan_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  serverId: text("server_id"),
  isTest: boolean("is_test").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AlertLog = typeof alertLogTable.$inferSelect;
