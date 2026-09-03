/** Application-layer tests: scheduling service (pattern CRUD, targeting, manager edits). */
jest.mock("@/core/db", () => ({
  db: { transaction: (fn: (tx: unknown) => unknown) => fn({}) },
  schema: {},
}));
jest.mock("@/modules/scheduling/infrastructure/monthCache", () => ({
  invalidateFrom: jest.fn(),
  invalidateMonths: jest.fn(),
  getMonthCache: jest.fn(),
  setMonthCache: jest.fn(),
}));
jest.mock("@/modules/scheduling/infrastructure/scheduleRepository", () => ({
  findDefaultById: jest.fn(),
  listDefaultSchedules: jest.fn(),
  findUpdatedById: jest.fn(),
  findLiveOccurrenceException: jest.fn(),
  insertDefault: jest.fn(),
  updateDefault: jest.fn(),
  insertUpdated: jest.fn(),
  softDeleteUpdated: jest.fn(),
  updateUpdatedFields: jest.fn(),
  getResolvedShifts: jest.fn(),
}));

import * as svc from "@/modules/scheduling/application/schedulingService";
import * as cache from "@/modules/scheduling/infrastructure/monthCache";
import * as repo from "@/modules/scheduling/infrastructure/scheduleRepository";

const r = repo as jest.Mocked<typeof repo>;
const c = cache as jest.Mocked<typeof cache>;

/** 09:00 KST == 00:00 UTC on the reference date; +4h == 13:00 KST. */
const patternRow = {
  id: 1,
  userId: 5,
  dayOfWeek: "MON" as const,
  startTime: new Date("1970-01-01T00:00:00Z"),
  endTime: new Date("1970-01-01T04:00:00Z"),
  startDate: "2026-01-01",
  endDate: null as string | null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const updatedRow = {
  id: 20,
  userId: 5,
  defaultScheduleId: 1 as number | null,
  kind: "MODIFY" as const,
  updateDate: "2026-03-09",
  startAt: new Date("2026-03-09T01:00:00Z"),
  endAt: new Date("2026-03-09T05:00:00Z"),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null as Date | null,
  version: 1,
};

beforeEach(() => {
  r.getResolvedShifts.mockResolvedValue([]);
  c.invalidateFrom.mockResolvedValue(undefined);
  c.invalidateMonths.mockResolvedValue(undefined);
});

describe("default-schedule CRUD", () => {
  test("createDefaultSchedule anchors HH:MM, inserts, invalidates from startDate", async () => {
    r.insertDefault.mockImplementation(async (v) => ({ ...patternRow, ...v, id: 3 }));

    await svc.createDefaultSchedule(5, {
      dayOfWeek: "MON",
      startHhmm: "09:00",
      endHhmm: "13:00",
      startDate: "2026-01-01",
    });

    const arg = r.insertDefault.mock.calls[0]![0];
    expect(arg.userId).toBe(5);
    expect(arg.startTime).toBeInstanceOf(Date);
    expect(arg.endTime!.getTime() - arg.startTime!.getTime()).toBe(4 * 60 * 60 * 1000);
    expect(arg.endDate).toBeNull();
    expect(c.invalidateFrom).toHaveBeenCalledWith("2026-01-01");
  });

  test("updateDefaultSchedule → NOT_FOUND when missing", async () => {
    r.findDefaultById.mockResolvedValue(undefined);
    await expect(svc.updateDefaultSchedule(1, { dayOfWeek: "TUE" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("updateDefaultSchedule keeps times when no HH:MM patch", async () => {
    r.findDefaultById.mockResolvedValue(patternRow);
    r.updateDefault.mockResolvedValue({ ...patternRow, dayOfWeek: "TUE" });

    await svc.updateDefaultSchedule(1, { dayOfWeek: "TUE" });

    const arg = r.updateDefault.mock.calls[0]![1];
    expect(arg.dayOfWeek).toBe("TUE");
    expect(arg.startTime).toBe(patternRow.startTime);
    expect(arg.endTime).toBe(patternRow.endTime);
  });

  test("updateDefaultSchedule re-anchors when startHhmm changes", async () => {
    r.findDefaultById.mockResolvedValue(patternRow);
    r.updateDefault.mockResolvedValue(patternRow);

    await svc.updateDefaultSchedule(1, { startHhmm: "10:00" });

    const arg = r.updateDefault.mock.calls[0]![1];
    expect(arg.startTime!.getTime()).toBe(patternRow.startTime.getTime() + 60 * 60 * 1000);
  });

  test("endDefaultSchedule sets endDate and invalidates from it", async () => {
    r.updateDefault.mockResolvedValue({ ...patternRow, endDate: "2026-05-01" });
    await svc.endDefaultSchedule(1, "2026-05-01");
    expect(r.updateDefault).toHaveBeenCalledWith(1, { endDate: "2026-05-01" });
    expect(c.invalidateFrom).toHaveBeenCalledWith("2026-05-01");
  });

  test("endDefaultSchedule → NOT_FOUND when missing", async () => {
    r.updateDefault.mockResolvedValue(undefined);
    await expect(svc.endDefaultSchedule(1, "2026-05-01")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("resolveTargetShift", () => {
  test("updated target: missing → NOT_FOUND", async () => {
    r.findUpdatedById.mockResolvedValue(undefined);
    await expect(
      svc.resolveTargetShift(undefined as never, { date: "2026-03-09", targetUpdatedScheduleId: 20 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("updated target: CANCEL row → CONFLICT", async () => {
    r.findUpdatedById.mockResolvedValue({ ...updatedRow, kind: "CANCEL" });
    await expect(
      svc.resolveTargetShift(undefined as never, { date: "2026-03-09", targetUpdatedScheduleId: 20 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("updated target: ok → points at the updated row", async () => {
    r.findUpdatedById.mockResolvedValue(updatedRow);
    const t = await svc.resolveTargetShift(
      undefined as never,
      { date: "2026-03-09", targetUpdatedScheduleId: 20 },
    );
    expect(t).toMatchObject({
      updatedScheduleId: 20,
      defaultScheduleId: null,
      updatedKind: "MODIFY",
    });
  });

  test("default target: existing live exception → CONFLICT", async () => {
    r.findDefaultById.mockResolvedValue(patternRow);
    r.findLiveOccurrenceException.mockResolvedValue(updatedRow);
    await expect(
      svc.resolveTargetShift(undefined as never, { date: "2026-03-09", targetDefaultScheduleId: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("default target: ok → composes the occurrence from the pattern", async () => {
    r.findDefaultById.mockResolvedValue(patternRow);
    r.findLiveOccurrenceException.mockResolvedValue(undefined);
    const t = await svc.resolveTargetShift(
      undefined as never,
      { date: "2026-03-09", targetDefaultScheduleId: 1 },
    );
    expect(t.defaultScheduleId).toBe(1);
    expect(t.startAt.toISOString()).toBe("2026-03-09T00:00:00.000Z");
    expect(t.endAt.toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  test("neither ref → BAD_REQUEST", async () => {
    await expect(svc.resolveTargetShift(undefined as never, { date: "2026-03-09" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("checkUserConflicts", () => {
  test("returns overlapping existing shifts", async () => {
    r.getResolvedShifts.mockResolvedValue([
      {
        userId: 5,
        date: "2026-03-10",
        startAt: new Date("2026-03-10T10:00:00Z"),
        endAt: new Date("2026-03-10T14:00:00Z"),
        source: "DEFAULT",
        defaultScheduleId: 2,
        updatedScheduleId: null,
      },
    ]);
    const out = await svc.checkUserConflicts(5, "2026-03-10", {
      startAt: new Date("2026-03-10T09:00:00Z"),
      endAt: new Date("2026-03-10T13:00:00Z"),
    });
    expect(out).toHaveLength(1);
    expect(r.getResolvedShifts).toHaveBeenCalledWith({
      from: "2026-03-10",
      to: "2026-03-10",
      userId: 5,
      includeInactive: true,
    });
  });
});

describe("managerEditSchedule", () => {
  test("ADD with end <= start → BAD_REQUEST", async () => {
    await expect(
      svc.managerEditSchedule({
        kind: "ADD",
        userId: 5,
        updateDate: "2026-03-10",
        startAt: new Date("2026-03-10T13:00:00Z"),
        endAt: new Date("2026-03-10T09:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("ADD with an overlap → CONFLICT", async () => {
    r.getResolvedShifts.mockResolvedValue([
      {
        userId: 5,
        date: "2026-03-10",
        startAt: new Date("2026-03-10T10:00:00Z"),
        endAt: new Date("2026-03-10T14:00:00Z"),
        source: "DEFAULT",
        defaultScheduleId: 9,
        updatedScheduleId: null,
      },
    ]);
    await expect(
      svc.managerEditSchedule({
        kind: "ADD",
        userId: 5,
        updateDate: "2026-03-10",
        startAt: new Date("2026-03-10T09:00:00Z"),
        endAt: new Date("2026-03-10T13:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("ADD ok → one-off insert + month cache invalidation", async () => {
    const out = await svc.managerEditSchedule({
      kind: "ADD",
      userId: 5,
      updateDate: "2026-03-10",
      startAt: new Date("2026-03-10T09:00:00Z"),
      endAt: new Date("2026-03-10T13:00:00Z"),
    });
    expect(r.insertUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "ADD", defaultScheduleId: null, userId: 5 }),
      expect.anything(),
    );
    expect(c.invalidateMonths).toHaveBeenCalledWith(["2026-03"]);
    expect(out).toEqual({ affectedMonths: ["2026-03"] });
  });

  test("MODIFY on a missing pattern → NOT_FOUND", async () => {
    r.findDefaultById.mockResolvedValue(undefined);
    await expect(
      svc.managerEditSchedule({
        kind: "MODIFY",
        defaultScheduleId: 1,
        updateDate: "2026-03-09",
        startAt: new Date("2026-03-09T01:00:00Z"),
        endAt: new Date("2026-03-09T05:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("MODIFY with an existing exception → update in place", async () => {
    r.findDefaultById.mockResolvedValue(patternRow);
    r.findLiveOccurrenceException.mockResolvedValue(updatedRow);
    await svc.managerEditSchedule({
      kind: "MODIFY",
      defaultScheduleId: 1,
      updateDate: "2026-03-09",
      startAt: new Date("2026-03-09T02:00:00Z"),
      endAt: new Date("2026-03-09T06:00:00Z"),
    });
    expect(r.updateUpdatedFields).toHaveBeenCalledWith(
      20,
      expect.objectContaining({ kind: "MODIFY", version: 2 }),
      expect.anything(),
    );
    expect(r.insertUpdated).not.toHaveBeenCalled();
  });

  test("CANCEL with no existing exception → insert CANCEL using the occurrence times", async () => {
    r.findDefaultById.mockResolvedValue(patternRow);
    r.findLiveOccurrenceException.mockResolvedValue(undefined);
    await svc.managerEditSchedule({
      kind: "CANCEL",
      defaultScheduleId: 1,
      updateDate: "2026-03-09",
    });
    expect(r.insertUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "CANCEL",
        defaultScheduleId: 1,
        updateDate: "2026-03-09",
      }),
      expect.anything(),
    );
    const arg = r.insertUpdated.mock.calls[0]![0];
    expect(arg.startAt.toISOString()).toBe("2026-03-09T00:00:00.000Z");
  });
});
