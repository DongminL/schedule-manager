/** Application-layer tests: manager approval / rejection (conflict check + override ops). */
jest.mock("@/core/db", () => ({
  db: { transaction: (fn: (tx: unknown) => unknown) => fn({}) },
  schema: {},
}));
jest.mock("@/modules/change-request/infrastructure/changeRequestRepository", () => ({
  findParentById: jest.fn(),
  findTimeAdjustmentByParent: jest.fn(),
  findSubstituteByParent: jest.fn(),
  findSwapByParent: jest.fn(),
  markRejected: jest.fn(),
  markApproved: jest.fn(),
}));
jest.mock("@/modules/scheduling/application/schedulingService", () => ({
  resolveTargetShift: jest.fn(),
  checkUserConflicts: jest.fn(),
}));
jest.mock("@/modules/scheduling/infrastructure/scheduleRepository", () => ({
  insertUpdated: jest.fn(),
  softDeleteUpdated: jest.fn(),
  updateUpdatedFields: jest.fn(),
}));
jest.mock("@/modules/scheduling/infrastructure/monthCache", () => ({
  invalidateMonths: jest.fn(),
}));

import {
  approveChangeRequest,
  rejectChangeRequest,
} from "@/modules/change-request/application/approvalService";
import * as repo from "@/modules/change-request/infrastructure/changeRequestRepository";
import * as scheduling from "@/modules/scheduling/application/schedulingService";
import * as monthCache from "@/modules/scheduling/infrastructure/monthCache";
import * as schedRepo from "@/modules/scheduling/infrastructure/scheduleRepository";

const r = repo as jest.Mocked<typeof repo>;
const sched = scheduling as jest.Mocked<typeof scheduling>;
const sr = schedRepo as jest.Mocked<typeof schedRepo>;
const mc = monthCache as jest.Mocked<typeof monthCache>;

const parent = {
  id: 10,
  userId: 5,
  approveBy: null as number | null,
  type: "TIME_ADJUST" as "TIME_ADJUST" | "SHIFT" | "SWAP",
  updateDate: "2026-03-10",
  startAt: new Date("2026-03-10T00:00:00Z"),
  endAt: new Date("2026-03-10T04:00:00Z"),
  targetDefaultScheduleId: 1 as number | null,
  targetUpdatedScheduleId: null as number | null,
  reason: "사유",
  rejectReason: null as string | null,
  status: "PENDING" as string,
  peerAcceptedAt: null as Date | null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null as Date | null,
  version: 1,
};

const targetShift = {
  date: "2026-03-10",
  startAt: new Date("2026-03-10T00:00:00Z"),
  endAt: new Date("2026-03-10T04:00:00Z"),
  defaultScheduleId: 1,
  updatedScheduleId: null,
};

beforeEach(() => {
  sched.resolveTargetShift.mockResolvedValue(targetShift);
  sched.checkUserConflicts.mockResolvedValue([]);
  mc.invalidateMonths.mockResolvedValue(undefined);
  r.markApproved.mockResolvedValue({ ...parent, status: "APPROVAL", version: 2 } as never);
});

describe("rejectChangeRequest", () => {
  test("missing → NOT_FOUND", async () => {
    r.findParentById.mockResolvedValue(undefined);
    await expect(rejectChangeRequest(1, 10, "사유")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("stale / version mismatch → CONFLICT", async () => {
    r.findParentById.mockResolvedValue(parent as never);
    r.markRejected.mockResolvedValue(undefined);
    await expect(rejectChangeRequest(1, 10, "사유", 1)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("ok → returns the rejected row", async () => {
    r.findParentById.mockResolvedValue(parent as never);
    r.markRejected.mockResolvedValue({
      ...parent,
      status: "REJECT",
      rejectReason: "사유",
    } as never);
    const out = await rejectChangeRequest(1, 10, "사유");
    expect(r.markRejected).toHaveBeenCalledWith(10, 1, "사유", 2, undefined);
    expect(out.status).toBe("REJECT");
  });
});

describe("approveChangeRequest — guards", () => {
  test("missing → NOT_FOUND", async () => {
    r.findParentById.mockResolvedValue(undefined);
    await expect(approveChangeRequest(1, 10)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("not PENDING → CONFLICT", async () => {
    r.findParentById.mockResolvedValue({ ...parent, status: "APPROVAL" } as never);
    await expect(approveChangeRequest(1, 10)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("version mismatch → VERSION_CONFLICT", async () => {
    r.findParentById.mockResolvedValue(parent as never);
    await expect(approveChangeRequest(1, 10, 99)).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
  });

  test("optimistic lock lost at write → VERSION_CONFLICT", async () => {
    r.findParentById.mockResolvedValue(parent as never);
    r.findTimeAdjustmentByParent.mockResolvedValue({
      adjustStartAt: new Date("2026-03-10T01:00:00Z"),
      adjustEndAt: new Date("2026-03-10T05:00:00Z"),
    } as never);
    r.markApproved.mockResolvedValue(undefined);
    await expect(approveChangeRequest(1, 10)).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });
});

describe("approveChangeRequest — TIME_ADJUST", () => {
  beforeEach(() => {
    r.findParentById.mockResolvedValue({ ...parent, type: "TIME_ADJUST" } as never);
    r.findTimeAdjustmentByParent.mockResolvedValue({
      adjustStartAt: new Date("2026-03-10T01:00:00Z"),
      adjustEndAt: new Date("2026-03-10T05:00:00Z"),
    } as never);
  });

  test("detail row missing → NOT_FOUND", async () => {
    r.findTimeAdjustmentByParent.mockResolvedValue(undefined);
    await expect(approveChangeRequest(1, 10)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("double-booking → CONFLICT", async () => {
    sched.checkUserConflicts.mockResolvedValue([{ x: 1 }] as never);
    await expect(approveChangeRequest(1, 10)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(sr.insertUpdated).not.toHaveBeenCalled();
  });

  test("ok → one MODIFY override, request approved, month cache cleared", async () => {
    const out = await approveChangeRequest(1, 10);
    expect(sr.insertUpdated).toHaveBeenCalledTimes(1);
    expect(sr.insertUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "MODIFY", defaultScheduleId: 1, userId: 5 }),
      expect.anything(),
    );
    expect(r.markApproved).toHaveBeenCalledWith(10, 1, 1, expect.anything());
    expect(mc.invalidateMonths).toHaveBeenCalledWith(["2026-03"]);
    expect(out.request.status).toBe("APPROVAL");
  });
});

describe("approveChangeRequest — SHIFT", () => {
  const shiftParent = { ...parent, type: "SHIFT" as const, peerAcceptedAt: new Date() };

  beforeEach(() => {
    r.findParentById.mockResolvedValue(shiftParent as never);
    r.findSubstituteByParent.mockResolvedValue({ userId: 8 } as never);
  });

  test("substitute has not accepted → CONFLICT", async () => {
    r.findParentById.mockResolvedValue({ ...shiftParent, peerAcceptedAt: null } as never);
    await expect(approveChangeRequest(1, 10)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(sr.insertUpdated).not.toHaveBeenCalled();
  });

  test("detail missing → NOT_FOUND", async () => {
    r.findSubstituteByParent.mockResolvedValue(undefined);
    await expect(approveChangeRequest(1, 10)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("substitute already booked → CONFLICT", async () => {
    sched.checkUserConflicts.mockResolvedValue([{ x: 1 }] as never);
    await expect(approveChangeRequest(1, 10)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("ok → CANCEL requester + ADD substitute (2 overrides)", async () => {
    await approveChangeRequest(1, 10);
    expect(sr.insertUpdated).toHaveBeenCalledTimes(2);
    const kinds = sr.insertUpdated.mock.calls.map((c) => (c[0] as { kind: string }).kind);
    expect(kinds).toEqual(["CANCEL", "ADD"]);
  });
});

describe("approveChangeRequest — SWAP", () => {
  const swapParent = { ...parent, type: "SWAP" as const, peerAcceptedAt: new Date() };

  beforeEach(() => {
    r.findParentById.mockResolvedValue(swapParent as never);
    r.findSwapByParent.mockResolvedValue({
      peerUserId: 8,
      swapDate: "2026-04-05",
      peerTargetDefaultScheduleId: 2,
      peerTargetUpdatedScheduleId: null,
    } as never);
    sched.resolveTargetShift
      .mockResolvedValueOnce(targetShift)
      .mockResolvedValueOnce({
        date: "2026-04-05",
        startAt: new Date("2026-04-05T00:00:00Z"),
        endAt: new Date("2026-04-05T04:00:00Z"),
        defaultScheduleId: 2,
        updatedScheduleId: null,
      });
  });

  test("peer has not accepted → CONFLICT", async () => {
    r.findParentById.mockResolvedValue({ ...swapParent, peerAcceptedAt: null } as never);
    await expect(approveChangeRequest(1, 10)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("swap detail missing → NOT_FOUND", async () => {
    r.findSwapByParent.mockResolvedValue(undefined);
    await expect(approveChangeRequest(1, 10)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("double-booking on either side → CONFLICT", async () => {
    sched.checkUserConflicts
      .mockResolvedValueOnce([{ x: 1 }] as never)
      .mockResolvedValueOnce([]);
    await expect(approveChangeRequest(1, 10)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("ok → 4 overrides, both months invalidated", async () => {
    const out = await approveChangeRequest(1, 10);
    expect(sr.insertUpdated).toHaveBeenCalledTimes(4);
    expect(mc.invalidateMonths).toHaveBeenCalledWith(
      expect.arrayContaining(["2026-03", "2026-04"]),
    );
    expect(out.affectedMonths).toHaveLength(2);
  });
});
