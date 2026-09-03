import { boolean, pgTable, serial, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const ROLES = ["MANAGER", "STAFF"] as const;
export type Role = (typeof ROLES)[number];

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
    password: varchar("password", { length: 255 }).notNull(),
    name: varchar("name", { length: 50 }).notNull(),
    role: varchar("role", { length: 10 }).$type<Role>().notNull().default("STAFF"),
    color: varchar("color", { length: 7 }).notNull().default("#cccccc"),
    isActive: boolean("is_active").notNull().default(true),
    // Forced first-login password change (temp password == phone number).
    mustChangePassword: boolean("must_change_password").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_users_phone_number").on(t.phoneNumber)],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
