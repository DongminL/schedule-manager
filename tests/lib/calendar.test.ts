import {
  DOW_LABELS,
  addMonths,
  durationMinutes,
  dowIndex,
  kstClock,
  monthGridDays,
  weekDays,
} from "@/lib/calendar";

describe("calendar helpers", () => {
  test("weekday labels are Sunday-first", () => {
    expect([...DOW_LABELS]).toEqual(["일", "월", "화", "수", "목", "금", "토"]);
  });

  test("monthGridDays returns 42 days starting on a Sunday and covering the month", () => {
    const grid = monthGridDays("2026-09-15");
    expect(grid).toHaveLength(42);
    expect(dowIndex(grid[0]!)).toBe(0); // Sunday
    expect(dowIndex(grid[41]!)).toBe(6); // Saturday
    expect(grid).toContain("2026-09-01");
    expect(grid).toContain("2026-09-30");
    // Sept 2026: 1st is a Tuesday -> grid starts on Aug 30.
    expect(grid[0]).toBe("2026-08-30");
  });

  test("weekDays returns the Sun→Sat week containing the date", () => {
    const w = weekDays("2026-09-11"); // Friday
    expect(w).toEqual([
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
    ]);
  });

  test("addMonths clamps the day to the target month length", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  test("kstClock reads wall-clock minutes in Asia/Seoul", () => {
    // 2026-09-10T02:00:00Z === 11:00 KST
    expect(kstClock("2026-09-10T02:00:00.000Z").label).toBe("11:00");
    expect(kstClock("2026-09-10T02:00:00.000Z").minutes).toBe(660);
  });

  test("durationMinutes handles an overnight shift", () => {
    // 22:00 KST -> 06:00 KST next day = 8h
    expect(durationMinutes("2026-09-11T13:00:00.000Z", "2026-09-11T21:00:00.000Z")).toBe(480);
  });
});
