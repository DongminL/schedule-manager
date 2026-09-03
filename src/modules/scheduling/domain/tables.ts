import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "../../account/domain/tables";

export const DAYS_OF_WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const OVERRIDE_KINDS = ["ADD", "MODIFY", "CANCEL"] as const;
export type OverrideKind = (typeof OVERRIDE_KINDS)[number];

/** Weekly recurring pattern. Times anchored on 1970-01-01 KST; only time-of-day
 *  + start->end duration matter. `startDate`/`endDate` bound the recurrence. */
export const defaultSchedule = pgTable(
  "default_schedule",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    dayOfWeek: varchar("day_of_week", { length: 3 }).$type<DayOfWeek>().notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_default_schedule_user_dow").on(t.userId, t.dayOfWeek),
    index("idx_default_schedule_window").on(t.startDate, t.endDate),
  ],
);

/** Per-date exception layered over a pattern occurrence, or a one-off shift. */
export const updatedSchedule = pgTable(
  "updated_schedule",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // NULL => one-off shift (kind must be ADD). NOT NULL => exception (MODIFY | CANCEL).
    defaultScheduleId: integer("default_schedule_id").references(() => defaultSchedule.id, {
      onDelete: "cascade",
    }),
    kind: varchar("kind", { length: 10 }).$type<OverrideKind>().notNull(),
    updateDate: date("update_date").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    index("idx_updated_schedule_user_date").on(t.userId, t.updateDate),
    index("idx_updated_schedule_date").on(t.updateDate),
    uniqueIndex("uq_updated_schedule_occurrence")
      .on(t.defaultScheduleId, t.updateDate)
      .where(sql`${t.deletedAt} is null and ${t.defaultScheduleId} is not null`),
  ],
);

export type DefaultScheduleRow = typeof defaultSchedule.$inferSelect;
export type NewDefaultScheduleRow = typeof defaultSchedule.$inferInsert;
export type UpdatedScheduleRow = typeof updatedSchedule.$inferSelect;
export type NewUpdatedScheduleRow = typeof updatedSchedule.$inferInsert;
