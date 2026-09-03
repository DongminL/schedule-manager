import { and, asc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";

import { db, type Exec } from "@/core/db";
import {
  defaultSchedule,
  updatedSchedule,
  users,
  type DefaultScheduleRow,
  type NewDefaultScheduleRow,
  type NewUpdatedScheduleRow,
  type OverrideKind,
  type UpdatedScheduleRow,
} from "@/core/db/schema";

import { resolveShifts, type ResolvedShift } from "../domain/scheduleResolver";

export type { Exec };

/* --------------------------------------------------------------- reads -- */

export function findDefaultById(
  id: number,
  exec: Exec = db,
): Promise<DefaultScheduleRow | undefined> {
  return exec
    .select()
    .from(defaultSchedule)
    .where(eq(defaultSchedule.id, id))
    .limit(1)
    .then((r) => r[0]);
}

export function listDefaultSchedules(userId: number): Promise<DefaultScheduleRow[]> {
  return db
    .select()
    .from(defaultSchedule)
    .where(eq(defaultSchedule.userId, userId))
    .orderBy(asc(defaultSchedule.dayOfWeek), asc(defaultSchedule.startTime));
}

export function findUpdatedById(
  id: number,
  exec: Exec = db,
): Promise<UpdatedScheduleRow | undefined> {
  return exec
    .select()
    .from(updatedSchedule)
    .where(eq(updatedSchedule.id, id))
    .limit(1)
    .then((r) => r[0]);
}

export function findLiveOccurrenceException(
  defaultScheduleId: number,
  date: string,
  exec: Exec = db,
): Promise<UpdatedScheduleRow | undefined> {
  return exec
    .select()
    .from(updatedSchedule)
    .where(
      and(
        eq(updatedSchedule.defaultScheduleId, defaultScheduleId),
        eq(updatedSchedule.updateDate, date),
        isNull(updatedSchedule.deletedAt),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
}

/* --------------------------------------------------------------- writes -- */

export function insertDefault(values: NewDefaultScheduleRow): Promise<DefaultScheduleRow> {
  return db
    .insert(defaultSchedule)
    .values(values)
    .returning()
    .then((r) => r[0]!);
}

export function updateDefault(
  id: number,
  patch: Partial<NewDefaultScheduleRow>,
): Promise<DefaultScheduleRow | undefined> {
  return db
    .update(defaultSchedule)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(defaultSchedule.id, id))
    .returning()
    .then((r) => r[0]);
}

export function insertUpdated(
  values: NewUpdatedScheduleRow,
  exec: Exec = db,
): Promise<UpdatedScheduleRow> {
  return exec
    .insert(updatedSchedule)
    .values(values)
    .returning()
    .then((r) => r[0]!);
}

export function softDeleteUpdated(id: number, exec: Exec = db): Promise<unknown> {
  return exec
    .update(updatedSchedule)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(updatedSchedule.id, id));
}

export function updateUpdatedFields(
  id: number,
  patch: { kind?: OverrideKind; startAt?: Date; endAt?: Date; version?: number },
  exec: Exec = db,
): Promise<unknown> {
  return exec
    .update(updatedSchedule)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(updatedSchedule.id, id));
}

/* ----------------------------------------------------------- resolution -- */

export interface ResolveOptions {
  from: string;
  to: string;
  userId?: number;
  includeInactive?: boolean;
}

/** DB-backed resolution for one user or the whole active roster. */
export async function getResolvedShifts(opts: ResolveOptions): Promise<ResolvedShift[]> {
  const { from, to, userId, includeInactive = false } = opts;

  const activeUserIds = userId
    ? undefined
    : (
        await db
          .select({ id: users.id })
          .from(users)
          .where(includeInactive ? undefined : eq(users.isActive, true))
      ).map((r) => r.id);

  const roster = activeUserIds && activeUserIds.length ? activeUserIds : [-1];

  const defaultsWhere = and(
    userId ? eq(defaultSchedule.userId, userId) : undefined,
    activeUserIds ? inArray(defaultSchedule.userId, roster) : undefined,
    lte(defaultSchedule.startDate, to),
    or(isNull(defaultSchedule.endDate), gte(defaultSchedule.endDate, from)),
  );

  const updatesWhere = and(
    userId ? eq(updatedSchedule.userId, userId) : undefined,
    activeUserIds ? inArray(updatedSchedule.userId, roster) : undefined,
    isNull(updatedSchedule.deletedAt),
    gte(updatedSchedule.updateDate, from),
    lte(updatedSchedule.updateDate, to),
  );

  const [defaults, updates] = await Promise.all([
    db.select().from(defaultSchedule).where(defaultsWhere),
    db.select().from(updatedSchedule).where(updatesWhere),
  ]);

  return resolveShifts(defaults, updates, from, to);
}
