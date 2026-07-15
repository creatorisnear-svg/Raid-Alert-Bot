import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clansTable = pgTable("clans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  leaderId: integer("leader_id").notNull(),
  isPrivate: boolean("is_private").notNull().default(false),
  raidKey: text("raid_key"),
  kaosApiKey: text("kaos_api_key"),
  discordServerId: text("discord_server_id"),
  discordChannelId: text("discord_channel_id"),
  discordChannelName: text("discord_channel_name"),
  pingRole: text("ping_role").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClanSchema = createInsertSchema(clansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClan = z.infer<typeof insertClanSchema>;
export type Clan = typeof clansTable.$inferSelect;
