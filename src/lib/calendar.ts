/**
 * Pure calendar helpers for the views. All "date" values are `YYYY-MM-DD`
 * strings (matching the API's resolved-shift `date` field); wall-clock times are
 * read from ISO instants in Asia/Seoul (KST, fixed +09:00, no DST).
 */

export const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertYmd(s: string): void {
  if (!DATE_RE.test(s)) throw new Error(`expected YYYY-MM-DD, got: ${s}`);
}

/** UTC Date at midnight for a YMD string — a safe carrier for date-only math. */
function toUtc(ymd: string): Date {
  assertYmd(ymd);
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(ymd: string, n: number): string {
  const dt = toUtc(ymd);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUtc(dt);
}

/** Today's KST calendar date as "YYYY-MM-DD" (KST is a fixed +09:00, no DST). */
export function kstToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** ("2026-09-13", "09:30") -> ISO instant for 09:30 KST that day. */
export function hhmmToIso(date: string, hhmm: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = hhmm.split(":").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - KST_OFFSET_MS).toISOString();
}

/**
 * Start/end instants for a shift on `date`. If the end time is at or before the
 * start (overnight), the end rolls to the next day so the pair has a real,
 * positive duration.
 */
export function shiftInstants(
  date: string,
  startHhmm: string,
  endHhmm: string,
): { startAt: string; endAt: string } {
  const startAt = hhmmToIso(date, startHhmm);
  let endAt = hhmmToIso(date, endHhmm);
  if (Date.parse(endAt) <= Date.parse(startAt)) {
    endAt = hhmmToIso(addDays(date, 1), endHhmm);
  }
  return { startAt, endAt };
}

export function addMonths(ymd: string, n: number): string {
  const dt = toUtc(ymd);
  const target = dt.getUTCMonth() + n;
  const firstOfTarget = new Date(Date.UTC(dt.getUTCFullYear(), target, 1));
  // Clamp day so e.g. Jan 31 + 1 month -> Feb 28/29.
  const lastDay = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0),
  ).getUTCDate();
  firstOfTarget.setUTCDate(Math.min(dt.getUTCDate(), lastDay));
  return fromUtc(firstOfTarget);
}

/** 0 = Sunday … 6 = Saturday. */
export function dowIndex(ymd: string): number {
  return toUtc(ymd).getUTCDay();
}

export function firstOfMonth(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

export function isSameMonth(ymd: string, ref: string): boolean {
  return ymd.slice(0, 7) === ref.slice(0, 7);
}

/** Sunday that starts the week containing `ymd`. */
export function startOfWeekSun(ymd: string): string {
  return addDays(ymd, -dowIndex(ymd));
}

/** The 7 dates (Sun→Sat) of the week containing `ymd`. */
export function weekDays(ymd: string): string[] {
  const start = startOfWeekSun(ymd);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 42 dates (6 rows × Sun→Sat) covering the month that contains `ymd`. */
export function monthGridDays(ymd: string): string[] {
  const gridStart = startOfWeekSun(firstOfMonth(ymd));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

const kstFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export interface Clock {
  hh: string; // "09"
  mm: string; // "05"
  label: string; // "09:05"
  minutes: number; // minutes from KST midnight, 0..1439
}

export function kstClock(iso: string): Clock {
  const parts = kstFmt.formatToParts(new Date(iso));
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  const h = Number(hh) % 24; // "24:00" -> 0
  return { hh, mm, label: `${hh}:${mm}`, minutes: h * 60 + Number(mm) };
}

/** Whole-minute duration between two ISO instants. */
export function durationMinutes(startIso: string, endIso: string): number {
  return Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000);
}

export function monthTitle(ymd: string): string {
  const [y, m] = ymd.split("-");
  return `${y}년 ${Number(m)}월`;
}

export function dayTitle(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${y}년 ${Number(m)}월 ${Number(d)}일 (${DOW_LABELS[dowIndex(ymd)]})`;
}
