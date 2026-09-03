import type { DefaultScheduleRow, OverrideKind, UpdatedScheduleRow } from "@/core/db/schema";
import { dayOfWeekOf, eachDate, occurrenceFromPattern, rangesOverlap } from "@/core/time/kst";

export type ShiftSource = "DEFAULT" | "UPDATED_MODIFY" | "UPDATED_ADD";

export interface ResolvedShift {
  userId: number;
  date: string; // KST business date, YYYY-MM-DD
  startAt: Date;
  endAt: Date;
  source: ShiftSource;
  defaultScheduleId: number | null;
  updatedScheduleId: number | null;
}

/** The concrete shift a change request targets. */
export interface TargetShift {
  date: string;
  startAt: Date;
  endAt: Date;
  defaultScheduleId: number | null;
  updatedScheduleId: number | null;
  /** kind of the existing updated row, when `updatedScheduleId` is set */
  updatedKind?: OverrideKind;
}

export interface ConflictCandidate {
  startAt: Date;
  endAt: Date;
}

export interface IgnoreRef {
  defaultScheduleId?: number | null;
  updatedScheduleId?: number | null;
}

function occurrenceKey(defaultScheduleId: number, date: string): string {
  return `${defaultScheduleId}|${date}`;
}

/** Pure resolution. `updates` must already be filtered to live rows (deletedAt IS NULL). */
export function resolveShifts(
  defaults: DefaultScheduleRow[],
  updates: UpdatedScheduleRow[],
  from: string,
  to: string,
): ResolvedShift[] {
  const exceptionByOccurrence = new Map<string, UpdatedScheduleRow>();
  const oneOffAdds: UpdatedScheduleRow[] = [];

  for (const u of updates) {
    if (u.defaultScheduleId != null) {
      exceptionByOccurrence.set(occurrenceKey(u.defaultScheduleId, u.updateDate), u);
    } else if (u.kind === "ADD") {
      oneOffAdds.push(u);
    }
  }

  const out: ResolvedShift[] = [];

  for (const date of eachDate(from, to)) {
    const dow = dayOfWeekOf(date);
    for (const d of defaults) {
      if (d.dayOfWeek !== dow) continue;
      if (date < d.startDate) continue;
      if (d.endDate != null && date > d.endDate) continue;

      const exception = exceptionByOccurrence.get(occurrenceKey(d.id, date));
      if (exception) {
        if (exception.kind === "CANCEL") continue;
        out.push({
          userId: exception.userId,
          date,
          startAt: exception.startAt,
          endAt: exception.endAt,
          source: "UPDATED_MODIFY",
          defaultScheduleId: d.id,
          updatedScheduleId: exception.id,
        });
        continue;
      }

      const { startAt, endAt } = occurrenceFromPattern(date, d.startTime, d.endTime);
      out.push({
        userId: d.userId,
        date,
        startAt,
        endAt,
        source: "DEFAULT",
        defaultScheduleId: d.id,
        updatedScheduleId: null,
      });
    }
  }

  for (const add of oneOffAdds) {
    if (add.updateDate < from || add.updateDate > to) continue;
    out.push({
      userId: add.userId,
      date: add.updateDate,
      startAt: add.startAt,
      endAt: add.endAt,
      source: "UPDATED_ADD",
      defaultScheduleId: null,
      updatedScheduleId: add.id,
    });
  }

  out.sort((a, b) => a.userId - b.userId || a.startAt.getTime() - b.startAt.getTime());
  return out;
}

/**
 * Shifts in `existing` that overlap `candidate`, excluding the shift identified
 * by `ignore` (the one being changed must not conflict with itself).
 */
export function findConflicts(
  existing: ResolvedShift[],
  candidate: ConflictCandidate,
  ignore: IgnoreRef = {},
): ResolvedShift[] {
  return existing.filter((s) => {
    if (ignore.updatedScheduleId != null && s.updatedScheduleId === ignore.updatedScheduleId) {
      return false;
    }
    if (
      ignore.defaultScheduleId != null &&
      s.defaultScheduleId === ignore.defaultScheduleId &&
      s.updatedScheduleId == null
    ) {
      return false;
    }
    return rangesOverlap(s.startAt, s.endAt, candidate.startAt, candidate.endAt);
  });
}
