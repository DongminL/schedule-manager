import { hhmmToIso, isoToHhmm, shiftInstants } from "@/lib/kst";

describe("kst form helpers", () => {
  test("hhmmToIso builds the UTC instant for a KST wall-clock time", () => {
    // 09:00 KST on 2026-09-13 === 00:00Z
    expect(hhmmToIso("2026-09-13", "09:00")).toBe("2026-09-13T00:00:00.000Z");
    // 00:30 KST === previous day 15:30Z
    expect(hhmmToIso("2026-09-13", "00:30")).toBe("2026-09-12T15:30:00.000Z");
  });

  test("isoToHhmm reads the KST wall-clock time back", () => {
    expect(isoToHhmm("2026-09-13T00:00:00.000Z")).toBe("09:00");
    expect(isoToHhmm("2026-09-10T02:00:00.000Z")).toBe("11:00");
  });

  test("shiftInstants rolls the end to next day for an overnight shift", () => {
    const { startAt, endAt } = shiftInstants("2026-09-13", "22:00", "06:00");
    expect(startAt).toBe("2026-09-13T13:00:00.000Z"); // 22:00 KST on the 13th
    expect(endAt).toBe("2026-09-13T21:00:00.000Z"); // 06:00 KST on the 14th
    expect(isoToHhmm(endAt)).toBe("06:00");
    expect(Date.parse(endAt) - Date.parse(startAt)).toBe(8 * 3600 * 1000);
  });

  test("shiftInstants keeps a same-day shift on the same day", () => {
    const { startAt, endAt } = shiftInstants("2026-09-13", "09:00", "15:30");
    expect(startAt).toBe("2026-09-13T00:00:00.000Z");
    expect(endAt).toBe("2026-09-13T06:30:00.000Z");
  });
});
