/** Application-layer tests: calendar read model (month-blob cache assembly). */
jest.mock("@/modules/scheduling/infrastructure/monthCache", () => ({
  getMonthCache: jest.fn(),
  setMonthCache: jest.fn(),
  invalidateMonths: jest.fn(),
  invalidateFrom: jest.fn(),
}));
jest.mock("@/modules/scheduling/infrastructure/scheduleRepository", () => ({
  getResolvedShifts: jest.fn(),
}));

import { getCalendar } from "@/modules/scheduling/application/calendarService";
import * as cache from "@/modules/scheduling/infrastructure/monthCache";
import * as repo from "@/modules/scheduling/infrastructure/scheduleRepository";

const c = cache as jest.Mocked<typeof cache>;
const r = repo as jest.Mocked<typeof repo>;

function baseShift() {
  return {
    userId: 5,
    date: "2026-03-10",
    startAt: new Date("2026-03-10T00:00:00Z"),
    endAt: new Date("2026-03-10T04:00:00Z"),
    source: "DEFAULT" as const,
    defaultScheduleId: 1 as number | null,
    updatedScheduleId: null as number | null,
  };
}
const resolvedShift = (over: Partial<ReturnType<typeof baseShift>> = {}) => ({
  ...baseShift(),
  ...over,
});

const MANAGER_Q = {
  from: "2026-03-01",
  to: "2026-03-31",
  viewerRole: "MANAGER" as const,
  viewerId: 1,
};

beforeEach(() => {
  c.getMonthCache.mockResolvedValue(null);
  c.setMonthCache.mockResolvedValue(undefined);
});

describe("access scoping", () => {
  test("STAFF may view another user's calendar (needed for shift swaps)", async () => {
    r.getResolvedShifts.mockResolvedValue([
      resolvedShift({ userId: 5 }),
      resolvedShift({ userId: 9 }),
    ]);
    const out = await getCalendar({
      ...MANAGER_Q,
      viewerRole: "STAFF",
      viewerId: 5,
      userId: 9,
    });
    expect(out.userId).toBe(9);
    expect(out.shifts.every((s) => s.userId === 9)).toBe(true);
  });

  test("STAFF with no userId filter sees the whole store", async () => {
    r.getResolvedShifts.mockResolvedValue([
      resolvedShift({ userId: 5 }),
      resolvedShift({ userId: 9 }),
    ]);
    const out = await getCalendar({ ...MANAGER_Q, viewerRole: "STAFF", viewerId: 5 });
    expect(out.userId).toBeNull();
    expect(out.shifts).toHaveLength(2);
  });
});

describe("cache behaviour", () => {
  test("miss → resolves from DB, serialises dates, writes the month blob", async () => {
    r.getResolvedShifts.mockResolvedValue([resolvedShift()]);

    const out = await getCalendar(MANAGER_Q);

    expect(r.getResolvedShifts).toHaveBeenCalledWith({ from: "2026-03-01", to: "2026-03-31" });
    expect(c.setMonthCache).toHaveBeenCalledWith("2026-03", expect.any(String));
    expect(out.shifts).toHaveLength(1);
    expect(typeof out.shifts[0]!.startAt).toBe("string");
    expect(out.shifts[0]!.startAt).toBe("2026-03-10T00:00:00.000Z");
  });

  test("hit → uses the cached blob, never touches the DB", async () => {
    c.getMonthCache.mockResolvedValue(
      JSON.stringify([
        {
          userId: 5,
          date: "2026-03-10",
          startAt: "2026-03-10T00:00:00.000Z",
          endAt: "2026-03-10T04:00:00.000Z",
          source: "DEFAULT",
          defaultScheduleId: 1,
          updatedScheduleId: null,
        },
      ]),
    );
    const out = await getCalendar(MANAGER_Q);
    expect(r.getResolvedShifts).not.toHaveBeenCalled();
    expect(out.shifts).toHaveLength(1);
  });

  test("multi-month range resolves each month on miss", async () => {
    r.getResolvedShifts.mockResolvedValue([]);
    await getCalendar({ ...MANAGER_Q, from: "2026-01-15", to: "2026-03-02" });
    expect(r.getResolvedShifts).toHaveBeenCalledTimes(3);
  });
});

describe("filtering", () => {
  test("shifts outside [from,to] are dropped", async () => {
    r.getResolvedShifts.mockResolvedValue([
      resolvedShift({ date: "2026-03-10" }),
      resolvedShift({ date: "2026-04-01" }),
    ]);
    const out = await getCalendar({ ...MANAGER_Q, from: "2026-03-01", to: "2026-03-15" });
    expect(out.shifts.map((s) => s.date)).toEqual(["2026-03-10"]);
  });

  test("MANAGER can filter by an explicit userId", async () => {
    r.getResolvedShifts.mockResolvedValue([
      resolvedShift({ userId: 5 }),
      resolvedShift({ userId: 8 }),
    ]);
    const out = await getCalendar({ ...MANAGER_Q, userId: 8 });
    expect(out.shifts.every((s) => s.userId === 8)).toBe(true);
    expect(out.userId).toBe(8);
  });
});
