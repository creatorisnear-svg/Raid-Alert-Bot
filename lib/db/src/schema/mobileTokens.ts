import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const mobileTokensTable = pgTable("mobile_tokens", {
  id:        serial("id").primaryKey(),
  token:     text("token").notNull().unique(),
  userId:    integer("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MobileToken = typeof mobileTokensTable.$inferSelect;
