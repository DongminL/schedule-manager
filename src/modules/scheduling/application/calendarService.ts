import type { Role } from "@/core/db/schema";
import { monthBounds, monthsInRange } from "@/core/time/kst";

import type { ResolvedShift } from "../domain/scheduleResolver";
import { getMonthCache, setMonthCache } from "../infrastructure/monthCache";
import { getResolvedShifts } from "../infrastructure/scheduleRepository";

export interface CalendarShift {
  userId: number;
  date: string;
  startAt: string;
  endAt: string;
  source: ResolvedShift["source"];
  defaultScheduleId: number | null;
  updatedScheduleId: number | null;
}

const serialize = (s: ResolvedShift): CalendarShift => ({
  ...s,
  startAt: s.startAt.toISOString(),
  endAt: s.endAt.toISOString(),
});

async function monthShifts(yyyymm: string): Promise<CalendarShift[]> {
  const cached = await getMonthCache(yyyymm);
  if (cached) {
    try {
      return JSON.parse(cached) as CalendarShift[];
    } catch {
      // fall through and recompute
    }
  }
  const { from, to } = monthBounds(yyyymm);
  const fresh = (await getResolvedShifts({ from, to })).map(serialize);
  await setMonthCache(yyyymm, JSON.stringify(fresh));
  return fresh;
}

export interface CalendarQuery {
  from: string;
  to: string;
  userId?: number;
  viewerRole: Role;
  viewerId: number;
}

export interface CalendarResult {
  from: string;
  to: string;
  userId: number | null;
  shifts: CalendarShift[];
}

export async function getCalendar(q: CalendarQuery): Promise<CalendarResult> {
  // Any authenticated user may view the whole store's schedule (needed for
  // shift swaps); `userId` just narrows the result set.
  const userId = q.userId;

  const months = monthsInRange(q.from, q.to);
  const all = (await Promise.all(months.map(monthShifts))).flat();

  const shifts = all
    .filter((s) => s.date >= q.from && s.date <= q.to)
    .filter((s) => (userId ? s.userId === userId : true))
    .sort((a, b) => a.userId - b.userId || a.startAt.localeCompare(b.startAt));

  return { from: q.from, to: q.to, userId: userId ?? null, shifts };
}
