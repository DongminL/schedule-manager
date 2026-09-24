import { index, integer, pgTable, serial, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { users } from "../../account/domain/tables";

/** FCM registration tokens. Policy: the last device a user logged in on wins. */
export const pushTokens = pgTable(
  "push_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 512 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_push_tokens_token").on(t.token),
    index("idx_push_tokens_user").on(t.userId),
  ],
);

export type PushTokenRow = typeof pushTokens.$inferSelect;
