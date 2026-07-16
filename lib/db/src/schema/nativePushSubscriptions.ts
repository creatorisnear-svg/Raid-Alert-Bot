import { pgTable, text, serial, timestamp, integer, unique } from "drizzle-orm/pg-core";

export const nativePushSubscriptionsTable = pgTable(
  "native_push_subscriptions",
  {
    id:        serial("id").primaryKey(),
    clanId:    integer("clan_id").notNull(),
    userId:    integer("user_id").notNull(),
    expoToken: text("expo_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.clanId, t.userId, t.expoToken)],
);

export type NativePushSubscription = typeof nativePushSubscriptionsTable.$inferSelect;
