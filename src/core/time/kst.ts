import { DAYS_OF_WEEK, type DayOfWeek } from "@/core/db/schema";

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Reference calendar day for `defaultSchedule` time-of-day anchoring. */
export const REFERENCE_DATE = "1970-01-01";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export interface KstParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  dayOfWeek: DayOfWeek;
}

/** Decompose an instant into KST wall-clock fields. */
export function kstParts(instant: Date): KstParts {
  const k = new Date(instant.getTime() + KST_OFFSET_MS);
  return {
    year: k.getUTCFullYear(),
    month: k.getUTCMonth() + 1,
    day: k.getUTCDate(),
    hour: k.getUTCHours(),
    minute: k.getUTCMinutes(),
    dayOfWeek: DAYS_OF_WEEK[k.getUTCDay()]!,
  };
}

/** Build the instant for a given KST wall-clock date + time. */
export function kstInstant(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - KST_OFFSET_MS);
}

/** "YYYY-MM-DD" of an instant, in KST. */
export function kstDateString(instant: Date): string {
  const p = kstParts(instant);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "HH:MM" of an instant, in KST. */
export function kstHhmm(instant: Date): string {
  const p = kstParts(instant);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Today's KST calendar date as "YYYY-MM-DD". */
export function kstToday(now: Date = new Date()): string {
  return kstDateString(now);
}

/** "YYYY-MM" of a "YYYY-MM-DD" string. */
export function monthKey(dateStr: string): string {
  assertDateString(dateStr);
  return dateStr.slice(0, 7);
}

export function assertDateString(value: string): void {
  if (!DATE_RE.test(value)) {
    throw new Error(`invalid date string (expected YYYY-MM-DD): ${value}`);
  }
}

/** KST day-of-week for a "YYYY-MM-DD" string. */
export function dayOfWeekOf(dateStr: string): DayOfWeek {
  assertDateString(dateStr);
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return DAYS_OF_WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
}

/** Inclusive list of "YYYY-MM-DD" strings from `from` to `to`. */
export function eachDate(from: string, to: string): string[] {
  assertDateString(from);
  assertDateString(to);
  const out: string[] = [];
  const [fy, fm, fd] = from.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = to.split("-").map(Number) as [number, number, number];
  const cursor = new Date(Date.UTC(fy, fm - 1, fd));
  const end = new Date(Date.UTC(ty, tm - 1, td));
  while (cursor.getTime() <= end.getTime()) {
    out.push(
      `${cursor.getUTCFullYear()}-${pad(cursor.getUTCMonth() + 1)}-${pad(cursor.getUTCDate())}`,
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** Distinct "YYYY-MM" keys spanned by an inclusive date range. */
export function monthsInRange(from: string, to: string): string[] {
  const seen = new Set<string>();
  for (const d of eachDate(from, to)) seen.add(d.slice(0, 7));
  return [...seen];
}

/** Inclusive "YYYY-MM-DD" bounds (first/last day) of a "YYYY-MM" month. */
export function monthBounds(yyyymm: string): { from: string; to: string } {
  const [y, m] = yyyymm.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${yyyymm}-01`, to: `${yyyymm}-${pad(last)}` };
}

/**
 * Anchor a "HH:MM" time-of-day pair onto the reference date, returning instants.
 * If `end <= start` the end is pushed to the next day (overnight pattern), so the
 * stored pair always has a positive, real duration.
 */
export function anchorRecurringTime(
  startHhmm: string,
  endHhmm: string,
): { startTime: Date; endTime: Date } {
  if (!HHMM_RE.test(startHhmm) || !HHMM_RE.test(endHhmm)) {
    throw new Error(`invalid time-of-day (expected HH:MM): ${startHhmm} / ${endHhmm}`);
  }
  const [sh, sm] = startHhmm.split(":").map(Number) as [number, number];
  const [eh, em] = endHhmm.split(":").map(Number) as [number, number];
  const [ry, rm, rd] = REFERENCE_DATE.split("-").map(Number) as [number, number, number];

  const startTime = kstInstant(ry, rm, rd, sh, sm);
  let endTime = kstInstant(ry, rm, rd, eh, em);
  if (endTime.getTime() <= startTime.getTime()) {
    endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
  }
  return { startTime, endTime };
}

/**
 * Compose a concrete shift on `dateStr` from a recurring pattern's anchored
 * times. Uses the pattern's KST time-of-day and its start->end duration.
 */
export function occurrenceFromPattern(
  dateStr: string,
  patternStart: Date,
  patternEnd: Date,
): { startAt: Date; endAt: Date } {
  assertDateString(dateStr);
  const { hour, minute } = kstParts(patternStart);
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const startAt = kstInstant(y, m, d, hour, minute);
  const durationMs = patternEnd.getTime() - patternStart.getTime();
  return { startAt, endAt: new Date(startAt.getTime() + durationMs) };
}

/** Overlap test for two [start, end) instant ranges. Touching edges do not overlap. */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}
