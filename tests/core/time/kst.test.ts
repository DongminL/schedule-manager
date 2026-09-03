import {
  anchorRecurringTime,
  dayOfWeekOf,
  eachDate,
  kstDateString,
  kstInstant,
  monthsInRange,
  occurrenceFromPattern,
  rangesOverlap,
} from "@/core/time/kst";

describe("KST helpers", () => {
  test("kstInstant / kstDateString round-trip a wall-clock date", () => {
    const inst = kstInstant(2026, 3, 10, 9, 0);
    // 09:00 KST on 2026-03-10 == 00:00 UTC
    expect(inst.toISOString()).toBe("2026-03-10T00:00:00.000Z");
    expect(kstDateString(inst)).toBe("2026-03-10");
  });

  test("kstDateString rolls the date correctly near midnight KST", () => {
    const inst = kstInstant(2026, 3, 10, 23, 30);
    expect(kstDateString(inst)).toBe("2026-03-10");
    const past = kstInstant(2026, 3, 11, 0, 30);
    expect(past.toISOString()).toBe("2026-03-10T15:30:00.000Z");
    expect(kstDateString(past)).toBe("2026-03-11");
  });

  test("dayOfWeekOf", () => {
    expect(dayOfWeekOf("2026-03-10")).toBe("TUE");
    expect(dayOfWeekOf("2026-03-09")).toBe("MON");
  });

  test("eachDate is inclusive and crosses month boundaries", () => {
    expect(eachDate("2026-01-30", "2026-02-02")).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
    ]);
  });

  test("monthsInRange", () => {
    expect(monthsInRange("2026-01-15", "2026-03-02")).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
  });
});

describe("anchorRecurringTime", () => {
  test("normal same-day shift keeps end on the reference day", () => {
    const { startTime, endTime } = anchorRecurringTime("09:00", "13:00");
    expect(endTime.getTime() - startTime.getTime()).toBe(4 * 60 * 60 * 1000);
  });

  test("overnight shift pushes end to the next day (positive duration)", () => {
    const { startTime, endTime } = anchorRecurringTime("22:00", "02:00");
    expect(endTime.getTime() - startTime.getTime()).toBe(4 * 60 * 60 * 1000);
  });

  test("rejects malformed input", () => {
    expect(() => anchorRecurringTime("9:00", "13:00")).toThrow();
    expect(() => anchorRecurringTime("09:00", "24:00")).toThrow();
  });
});

describe("occurrenceFromPattern", () => {
  test("composes a concrete same-day shift on the target date", () => {
    const { startTime, endTime } = anchorRecurringTime("09:00", "13:00");
    const occ = occurrenceFromPattern("2026-06-01", startTime, endTime);
    expect(occ.startAt.toISOString()).toBe("2026-06-01T00:00:00.000Z"); // 09:00 KST
    expect(occ.endAt.toISOString()).toBe("2026-06-01T04:00:00.000Z"); // 13:00 KST
  });

  test("overnight pattern spills the occurrence into the next calendar day", () => {
    const { startTime, endTime } = anchorRecurringTime("22:00", "02:00");
    const occ = occurrenceFromPattern("2026-06-01", startTime, endTime);
    expect(occ.startAt.toISOString()).toBe("2026-06-01T13:00:00.000Z"); // 22:00 KST
    expect(occ.endAt.toISOString()).toBe("2026-06-01T17:00:00.000Z"); // 02:00 KST next day
  });
});

describe("rangesOverlap", () => {
  const t = (h: number) => new Date(Date.UTC(2026, 0, 1, h));

  test("touching edges do not overlap", () => {
    expect(rangesOverlap(t(9), t(13), t(13), t(17))).toBe(false);
  });

  test("partial overlap is detected", () => {
    expect(rangesOverlap(t(9), t(13), t(12), t(15))).toBe(true);
  });

  test("containment is detected", () => {
    expect(rangesOverlap(t(9), t(18), t(12), t(13))).toBe(true);
  });
});
