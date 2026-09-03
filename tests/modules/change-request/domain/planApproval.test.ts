import { planApproval, type TargetShift } from "@/modules/change-request/domain/planApproval";

const d = (iso: string) => new Date(iso);

const patternTarget: TargetShift = {
  date: "2026-03-10",
  startAt: d("2026-03-10T00:00:00Z"),
  endAt: d("2026-03-10T04:00:00Z"),
  defaultScheduleId: 1,
  updatedScheduleId: null,
};

describe("planApproval — TIME_ADJUST", () => {
  test("writes a single MODIFY row against the pattern occurrence", () => {
    const ops = planApproval({
      type: "TIME_ADJUST",
      requesterId: 10,
      target: patternTarget,
      adjustStartAt: d("2026-03-10T01:00:00Z"),
      adjustEndAt: d("2026-03-10T05:00:00Z"),
    });
    expect(ops).toEqual([
      {
        op: "INSERT_UPDATED",
        userId: 10,
        defaultScheduleId: 1,
        kind: "MODIFY",
        updateDate: "2026-03-10",
        startAt: d("2026-03-10T01:00:00Z"),
        endAt: d("2026-03-10T05:00:00Z"),
      },
    ]);
  });

  test("editing an existing one-off (updated) target updates it in place", () => {
    const ops = planApproval({
      type: "TIME_ADJUST",
      requesterId: 10,
      target: {
        ...patternTarget,
        defaultScheduleId: null,
        updatedScheduleId: 55,
        updatedKind: "ADD",
      },
      adjustStartAt: d("2026-03-10T02:00:00Z"),
      adjustEndAt: d("2026-03-10T06:00:00Z"),
    });
    expect(ops).toEqual([
      {
        op: "SET_UPDATED",
        updatedScheduleId: 55,
        startAt: d("2026-03-10T02:00:00Z"),
        endAt: d("2026-03-10T06:00:00Z"),
      },
    ]);
  });
});

describe("planApproval — SHIFT (substitute)", () => {
  test("cancels the requester's occurrence and adds a one-off for the substitute", () => {
    const ops = planApproval({
      type: "SHIFT",
      requesterId: 10,
      target: patternTarget,
      substituteUserId: 20,
    });
    expect(ops).toEqual([
      {
        op: "INSERT_UPDATED",
        userId: 10,
        defaultScheduleId: 1,
        kind: "CANCEL",
        updateDate: "2026-03-10",
        startAt: patternTarget.startAt,
        endAt: patternTarget.endAt,
      },
      {
        op: "INSERT_UPDATED",
        userId: 20,
        defaultScheduleId: null,
        kind: "ADD",
        updateDate: "2026-03-10",
        startAt: patternTarget.startAt,
        endAt: patternTarget.endAt,
      },
    ]);
  });

  test("soft-deletes when the target is an existing one-off ADD", () => {
    const ops = planApproval({
      type: "SHIFT",
      requesterId: 10,
      target: {
        ...patternTarget,
        defaultScheduleId: null,
        updatedScheduleId: 77,
        updatedKind: "ADD",
      },
      substituteUserId: 20,
    });
    expect(ops[0]).toEqual({ op: "SOFT_DELETE_UPDATED", updatedScheduleId: 77 });
    expect(ops[1]).toMatchObject({ op: "INSERT_UPDATED", userId: 20, kind: "ADD" });
  });
});

describe("planApproval — SWAP", () => {
  const peerTarget: TargetShift = {
    date: "2026-03-12",
    startAt: d("2026-03-12T09:00:00Z"),
    endAt: d("2026-03-12T13:00:00Z"),
    defaultScheduleId: 2,
    updatedScheduleId: null,
  };

  test("produces cancel + add on both sides (4 ops)", () => {
    const ops = planApproval({
      type: "SWAP",
      requesterId: 10,
      target: patternTarget,
      peerUserId: 20,
      peerTarget,
    });
    expect(ops).toHaveLength(4);
    expect(ops[0]).toMatchObject({
      op: "INSERT_UPDATED",
      userId: 10,
      kind: "CANCEL",
      updateDate: "2026-03-10",
    });
    expect(ops[2]).toMatchObject({
      op: "INSERT_UPDATED",
      userId: 20,
      kind: "ADD",
      updateDate: "2026-03-10",
    });
    expect(ops[1]).toMatchObject({
      op: "INSERT_UPDATED",
      userId: 20,
      kind: "CANCEL",
      updateDate: "2026-03-12",
    });
    expect(ops[3]).toMatchObject({
      op: "INSERT_UPDATED",
      userId: 10,
      kind: "ADD",
      updateDate: "2026-03-12",
    });
  });
});
