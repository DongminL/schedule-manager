/**
 * KST wall-clock <-> ISO instant helpers for the change-request / manager-edit
 * forms. KST is a fixed +09:00 (no DST). The API's `instant` primitive wants an
 * ISO string with offset — `toISOString()` (Z) satisfies it.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** ("2026-09-13", "09:30") -> ISO instant for 09:30 KST that day. */
export function hhmmToIso(date: string, hhmm: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = hhmm.split(":").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - KST_OFFSET_MS).toISOString();
}

/** "HH:MM" of an ISO instant, in KST. */
export function isoToHhmm(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
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
    endAt = hhmmToIso(nextDay(date), endHhmm);
  }
  return { startAt, endAt };
}
