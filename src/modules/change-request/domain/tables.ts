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
import { defaultSchedule, updatedSchedule } from "../../scheduling/domain/tables";

export const CHANGE_TYPES = ["SHIFT", "SWAP", "TIME_ADJUST"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export const REQUEST_STATUS = [
  "PENDING",
  "WAITING_PEER_ACCEPT",
  "APPROVAL",
  "REJECT",
] as const;
export type RequestStatus = (typeof REQUEST_STATUS)[number];

export const scheduleChangeRequests = pgTable(
  "schedule_change_requests",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    approveBy: integer("approve_by").references(() => users.id, { onDelete: "set null" }),
    type: varchar("type", { length: 12 }).$type<ChangeType>().notNull(),
    updateDate: date("update_date").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    // Deterministic target pointer — exactly one is set.
    targetDefaultScheduleId: integer("target_default_schedule_id").references(
      () => defaultSchedule.id,
      { onDelete: "cascade" },
    ),
    targetUpdatedScheduleId: integer("target_updated_schedule_id").references(
      () => updatedSchedule.id,
      { onDelete: "cascade" },
    ),
    reason: varchar("reason", { length: 500 }).notNull(),
    rejectReason: varchar("reject_reason", { length: 500 }),
    status: varchar("status", { length: 20 })
      .$type<RequestStatus>()
      .notNull()
      .default("PENDING"),
    peerAcceptedAt: timestamp("peer_accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    index("idx_scr_status").on(t.status),
    index("idx_scr_user").on(t.userId),
    index("idx_scr_update_date").on(t.updateDate),
    uniqueIndex("uq_scr_pending_default_target")
      .on(t.userId, t.updateDate, t.targetDefaultScheduleId)
      .where(
        sql`${t.status} in ('PENDING','WAITING_PEER_ACCEPT') and ${t.deletedAt} is null and ${t.targetDefaultScheduleId} is not null`,
      ),
    uniqueIndex("uq_scr_pending_updated_target")
      .on(t.userId, t.targetUpdatedScheduleId)
      .where(
        sql`${t.status} in ('PENDING','WAITING_PEER_ACCEPT') and ${t.deletedAt} is null and ${t.targetUpdatedScheduleId} is not null`,
      ),
  ],
);

export const swapRequests = pgTable(
  "swap_requests",
  {
    id: serial("id").primaryKey(),
    scheduleChangeRequestId: integer("schedule_change_request_id")
      .notNull()
      .references(() => scheduleChangeRequests.id, { onDelete: "cascade" }),
    peerUserId: integer("peer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    swapDate: date("swap_date").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    peerTargetDefaultScheduleId: integer("peer_target_default_schedule_id").references(
      () => defaultSchedule.id,
      { onDelete: "cascade" },
    ),
    peerTargetUpdatedScheduleId: integer("peer_target_updated_schedule_id").references(
      () => updatedSchedule.id,
      { onDelete: "cascade" },
    ),
  },
  (t) => [
    uniqueIndex("uq_swap_requests_parent").on(t.scheduleChangeRequestId),
    index("idx_swap_requests_peer").on(t.peerUserId),
  ],
);

export const substituteRequests = pgTable(
  "substitute_requests",
  {
    id: serial("id").primaryKey(),
    scheduleChangeRequestId: integer("schedule_change_request_id")
      .notNull()
      .references(() => scheduleChangeRequests.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
  },
  (t) => [
    uniqueIndex("uq_substitute_requests_parent").on(t.scheduleChangeRequestId),
    index("idx_substitute_requests_user").on(t.userId),
  ],
);

export const timeAdjustmentRequests = pgTable(
  "time_adjustment_requests",
  {
    id: serial("id").primaryKey(),
    scheduleChangeRequestId: integer("schedule_change_request_id")
      .notNull()
      .references(() => scheduleChangeRequests.id, { onDelete: "cascade" }),
    adjustStartAt: timestamp("adjust_start_at", { withTimezone: true }).notNull(),
    adjustEndAt: timestamp("adjust_end_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("uq_time_adjustment_requests_parent").on(t.scheduleChangeRequestId)],
);

export type ScheduleChangeRequestRow = typeof scheduleChangeRequests.$inferSelect;
export type NewScheduleChangeRequestRow = typeof scheduleChangeRequests.$inferInsert;
export type SwapRequestRow = typeof swapRequests.$inferSelect;
export type SubstituteRequestRow = typeof substituteRequests.$inferSelect;
export type TimeAdjustmentRequestRow = typeof timeAdjustmentRequests.$inferSelect;
