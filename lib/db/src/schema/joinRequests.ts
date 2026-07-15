import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const joinRequestsTable = pgTable("join_requests", {
  id: serial("id").primaryKey(),
  clanId: integer("clan_id").notNull(),
  userId: integer("user_id").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertJoinRequestSchema = createInsertSchema(joinRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJoinRequest = z.infer<typeof insertJoinRequestSchema>;
export type JoinRequest = typeof joinRequestsTable.$inferSelect;
