import type { DefaultScheduleRow, UpdatedScheduleRow } from "@/core/db/schema";
import { findConflicts, resolveShifts, type ResolvedShift } from "@/modules/scheduling/domain/scheduleResolver";
import { anchorRecurringTime } from "@/core/time/kst";

const NOW = new Date("2026-01-01T00:00:00Z");

interface DefaultOpts {
  id: number;
  userId: number;
  dayOfWeek?: DefaultScheduleRow["dayOfWeek"];
  startHhmm?: string;
  endHhmm?: string;
  startDate?: string;
  endDate?: string | null;
}

function makeDefault(o: DefaultOpts): DefaultScheduleRow {
  const { startTime, endTime } = anchorRecurringTime(o.startHhmm ?? "09:00", o.endHhmm ?? "13:00");
  return {
    id: o.id,
    userId: o.userId,
    dayOfWeek: o.dayOfWeek ?? "MON",
    startTime,
    endTime,
    startDate: o.startDate ?? "2026-01-01",
    endDate: o.endDate ?? null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

interface UpdatedOpts {
  id: number;
  userId: number;
  kind: UpdatedScheduleRow["kind"];
  updateDate: string;
  defaultScheduleId?: number | null;
  startAt?: Date;
  endAt?: Date;
}

function makeUpdated(o: UpdatedOpts): UpdatedScheduleRow {
  return {
    id: o.id,
    userId: o.userId,
    defaultScheduleId: o.defaultScheduleId ?? null,
    kind: o.kind,
    updateDate: o.updateDate,
    startAt: o.startAt ?? new Date(`${o.updateDate}T01:00:00Z`),
    endAt: o.endAt ?? new Date(`${o.updateDate}T05:00:00Z`),
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    version: 1,
  };
}

// 2026-01-05 is a Monday.
const MON = "2026-01-05";

describe("resolveShifts", () => {
  test("emits the recurring pattern when there is no exception", () => {
    const d = makeDefault({ id: 1, userId: 10, dayOfWeek: "MON" });
    const shifts = resolveShifts([d], [], MON, MON);
    expect(shifts).toHaveLength(1);
    expect(shifts[0]).toMatchObject({
      userId: 10,
      date: MON,
      source: "DEFAULT",
      defaultScheduleId: 1,
    });
    expect(shifts[0]!.startAt.toISOString()).toBe("2026-01-05T00:00:00.000Z"); // 09:00 KST
  });

  test("respects the recurrence window (startDate / endDate)", () => {
    const notYet = makeDefault({ id: 1, userId: 10, startDate: "2026-02-01" });
    expect(resolveShifts([notYet], [], MON, MON)).toHaveLength(0);

    const ended = makeDefault({ id: 2, userId: 10, endDate: "2026-01-01" });
    expect(resolveShifts([ended], [], MON, MON)).toHaveLength(0);
  });

  test("MODIFY exception overrides the pattern's times", () => {
    const d = makeDefault({ id: 1, userId: 10 });
    const ex = makeUpdated({
      id: 99,
      userId: 10,
      kind: "MODIFY",
      updateDate: MON,
      defaultScheduleId: 1,
      startAt: new Date("2026-01-05T02:00:00Z"),
      endAt: new Date("2026-01-05T06:00:00Z"),
    });
    const shifts = resolveShifts([d], [ex], MON, MON);
    expect(shifts).toHaveLength(1);
    expect(shifts[0]).toMatchObject({
      source: "UPDATED_MODIFY",
      updatedScheduleId: 99,
      defaultScheduleId: 1,
    });
    expect(shifts[0]!.startAt.toISOString()).toBe("2026-01-05T02:00:00.000Z");
  });

  test("CANCEL exception removes the occurrence", () => {
    const d = makeDefault({ id: 1, userId: 10 });
    const ex = makeUpdated({
      id: 5,
      userId: 10,
      kind: "CANCEL",
      updateDate: MON,
      defaultScheduleId: 1,
    });
    expect(resolveShifts([d], [ex], MON, MON)).toHaveLength(0);
  });

  test("one-off ADD appears with no pattern", () => {
    const add = makeUpdated({ id: 7, userId: 20, kind: "ADD", updateDate: MON });
    const shifts = resolveShifts([], [add], MON, MON);
    expect(shifts).toHaveLength(1);
    expect(shifts[0]).toMatchObject({ userId: 20, source: "UPDATED_ADD", defaultScheduleId: null });
  });

  test("two patterns on the same weekday resolve independently", () => {
    const morning = makeDefault({ id: 1, userId: 10, startHhmm: "09:00", endHhmm: "13:00" });
    const evening = makeDefault({ id: 2, userId: 10, startHhmm: "18:00", endHhmm: "22:00" });
    const cancelEvening = makeUpdated({
      id: 3,
      userId: 10,
      kind: "CANCEL",
      updateDate: MON,
      defaultScheduleId: 2,
    });
    const shifts = resolveShifts([morning, evening], [cancelEvening], MON, MON);
    expect(shifts.map((s) => s.defaultScheduleId)).toEqual([1]);
  });
});

describe("findConflicts", () => {
  const shift = (over: Partial<ResolvedShift>): ResolvedShift => ({
    userId: 1,
    date: MON,
    startAt: new Date("2026-01-05T00:00:00Z"),
    endAt: new Date("2026-01-05T04:00:00Z"),
    source: "DEFAULT",
    defaultScheduleId: 1,
    updatedScheduleId: null,
    ...over,
  });

  test("overlapping candidate is flagged", () => {
    const conflicts = findConflicts([shift({})], {
      startAt: new Date("2026-01-05T03:00:00Z"),
      endAt: new Date("2026-01-05T07:00:00Z"),
    });
    expect(conflicts).toHaveLength(1);
  });

  test("the shift being changed is ignored", () => {
    const conflicts = findConflicts(
      [shift({ defaultScheduleId: 42 })],
      { startAt: new Date("2026-01-05T00:00:00Z"), endAt: new Date("2026-01-05T04:00:00Z") },
      { defaultScheduleId: 42 },
    );
    expect(conflicts).toHaveLength(0);
  });

  test("adjacent (non-overlapping) shift is not a conflict", () => {
    const conflicts = findConflicts([shift({})], {
      startAt: new Date("2026-01-05T04:00:00Z"),
      endAt: new Date("2026-01-05T08:00:00Z"),
    });
    expect(conflicts).toHaveLength(0);
  });
});
