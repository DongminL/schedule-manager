jest.mock("@/core/db", () => ({
  db: { transaction: (fn: (tx: unknown) => unknown) => fn({}) },
  schema: {},
}));
jest.mock("@/modules/change-request/infrastructure/changeRequestRepository", () => ({
  insertParent: jest.fn(),
  insertTimeAdjustment: jest.fn(),
  insertSubstitute: jest.fn(),
  insertSwap: jest.fn(),
  findParentById: jest.fn(),
  findSwapByParent: jest.fn(),
  findSubstituteByParent: jest.fn(),
  findTimeAdjustmentByParent: jest.fn(),
  listAll: jest.fn(),
  listPeerParentIds: jest.fn(),
  listForStaff: jest.fn(),
  markPeerAccepted: jest.fn(),
  markPeerRejected: jest.fn(),
}));
jest.mock("@/modules/account/infrastructure/userRepository", () => ({
  findById: jest.fn(),
  findByPhoneNumber: jest.fn(),
  list: jest.fn(),
  phoneNumberTakenByOther: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
}));
jest.mock("@/modules/scheduling/application/schedulingService", () => ({
  resolveTargetShift: jest.fn(),
  checkUserConflicts: jest.fn(),
}));

import * as userRepo from "@/modules/account/infrastructure/userRepository";
import * as svc from "@/modules/change-request/application/changeRequestService";
import * as repo from "@/modules/change-request/infrastructure/changeRequestRepository";
import * as scheduling from "@/modules/scheduling/application/schedulingService";

const r = repo as jest.Mocked<typeof repo>;
const users = userRepo as jest.Mocked<typeof userRepo>;
const sched = scheduling as jest.Mocked<typeof scheduling>;

const MANAGER = { id: 1, role: "MANAGER" as const, name: "점장", mustChangePassword: false };
const STAFF = { id: 5, role: "STAFF" as const, name: "알바", mustChangePassword: false };

const parent = {
  id: 10,
  userId: 5,
  approveBy: null as number | null,
  type: "TIME_ADJUST" as const,
  updateDate: "2026-03-10",
  startAt: new Date("2026-03-10T00:00:00Z"),
  endAt: new Date("2026-03-10T04:00:00Z"),
  targetDefaultScheduleId: 1 as number | null,
  targetUpdatedScheduleId: null as number | null,
  reason: "사유",
  rejectReason: null as string | null,
  status: "PENDING" as const,
  peerAcceptedAt: null as Date | null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null as Date | null,
  version: 1,
};

const activeUser = { isActive: true } as never;

const targetShift = {
  date: "2026-03-10",
  startAt: new Date("2026-03-10T00:00:00Z"),
  endAt: new Date("2026-03-10T04:00:00Z"),
  defaultScheduleId: 1,
  updatedScheduleId: null,
};

beforeEach(() => {
  sched.resolveTargetShift.mockResolvedValue(targetShift);
  r.insertParent.mockResolvedValue(parent);
  users.findById.mockResolvedValue(activeUser);
});

describe("createChangeRequest", () => {
  const base = {
    updateDate: "2026-03-10",
    startAt: new Date("2026-03-10T00:00:00Z"),
    endAt: new Date("2026-03-10T04:00:00Z"),
    reason: "사유",
    targetDefaultScheduleId: 1,
  };

  test("end <= start → BAD_REQUEST", async () => {
    await expect(
      svc.createChangeRequest(5, {
        ...base,
        type: "TIME_ADJUST",
        endAt: new Date("2026-03-10T00:00:00Z"),
        adjustStartAt: new Date("2026-03-10T01:00:00Z"),
        adjustEndAt: new Date("2026-03-10T05:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("TIME_ADJUST → validates target, inserts parent (PENDING) + detail", async () => {
    await svc.createChangeRequest(5, {
      ...base,
      type: "TIME_ADJUST",
      adjustStartAt: new Date("2026-03-10T01:00:00Z"),
      adjustEndAt: new Date("2026-03-10T05:00:00Z"),
    });
    expect(sched.resolveTargetShift).toHaveBeenCalled();
    expect(r.insertParent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 5, type: "TIME_ADJUST", status: "PENDING" }),
      expect.anything(),
    );
    expect(r.insertTimeAdjustment).toHaveBeenCalled();
  });

  test("TIME_ADJUST with adjustEnd <= adjustStart → BAD_REQUEST", async () => {
    await expect(
      svc.createChangeRequest(5, {
        ...base,
        type: "TIME_ADJUST",
        adjustStartAt: new Date("2026-03-10T05:00:00Z"),
        adjustEndAt: new Date("2026-03-10T01:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("SHIFT: substitute == requester → BAD_REQUEST", async () => {
    await expect(
      svc.createChangeRequest(5, { ...base, type: "SHIFT", substituteUserId: 5 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("SHIFT: inactive substitute → BAD_REQUEST", async () => {
    users.findById.mockResolvedValue({ isActive: false } as never);
    await expect(
      svc.createChangeRequest(5, { ...base, type: "SHIFT", substituteUserId: 7 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("SHIFT: ok → parent WAITING_PEER_ACCEPT, inserts substitute detail", async () => {
    await svc.createChangeRequest(5, { ...base, type: "SHIFT", substituteUserId: 7 });
    expect(r.insertParent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SHIFT", status: "WAITING_PEER_ACCEPT" }),
      expect.anything(),
    );
    expect(r.insertSubstitute).toHaveBeenCalledWith(
      { scheduleChangeRequestId: 10, userId: 7 },
      expect.anything(),
    );
  });

  test("SWAP: peer == requester → BAD_REQUEST", async () => {
    await expect(
      svc.createChangeRequest(5, {
        ...base,
        type: "SWAP",
        peerUserId: 5,
        peerUpdateDate: "2026-03-12",
        peerStartAt: new Date("2026-03-12T00:00:00Z"),
        peerEndAt: new Date("2026-03-12T04:00:00Z"),
        peerTargetDefaultScheduleId: 2,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("SWAP: ok → parent WAITING_PEER_ACCEPT, peer target resolved, swap inserted", async () => {
    await svc.createChangeRequest(5, {
      ...base,
      type: "SWAP",
      peerUserId: 8,
      peerUpdateDate: "2026-03-12",
      peerStartAt: new Date("2026-03-12T00:00:00Z"),
      peerEndAt: new Date("2026-03-12T04:00:00Z"),
      peerTargetDefaultScheduleId: 2,
    });
    expect(r.insertParent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "WAITING_PEER_ACCEPT" }),
      expect.anything(),
    );
    expect(sched.resolveTargetShift).toHaveBeenCalledTimes(2);
    expect(r.insertSwap).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleChangeRequestId: 10, peerUserId: 8 }),
      expect.anything(),
    );
  });
});

describe("listChangeRequests", () => {
  test("MANAGER → listAll", async () => {
    r.listAll.mockResolvedValue([parent]);
    await svc.listChangeRequests(MANAGER, "PENDING");
    expect(r.listAll).toHaveBeenCalledWith("PENDING");
  });

  test("STAFF → own + peer requests", async () => {
    r.listPeerParentIds.mockResolvedValue([99]);
    r.listForStaff.mockResolvedValue([parent]);
    await svc.listChangeRequests(STAFF);
    expect(r.listForStaff).toHaveBeenCalledWith(5, [99], undefined);
  });
});

describe("getChangeRequestDetail", () => {
  beforeEach(() => {
    r.findSubstituteByParent.mockResolvedValue(undefined);
    r.findSwapByParent.mockResolvedValue(undefined);
    r.findTimeAdjustmentByParent.mockResolvedValue(undefined);
  });

  test("missing → NOT_FOUND", async () => {
    r.findParentById.mockResolvedValue(undefined);
    await expect(svc.getChangeRequestDetail(10, STAFF)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("STAFF who is neither owner nor peer → FORBIDDEN", async () => {
    r.findParentById.mockResolvedValue({ ...parent, userId: 999 });
    await expect(svc.getChangeRequestDetail(10, STAFF)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("owner → returns parent with nested details", async () => {
    r.findParentById.mockResolvedValue(parent);
    const out = await svc.getChangeRequestDetail(10, STAFF);
    expect(out).toMatchObject({ id: 10, substitute: null, swap: null, timeAdjust: null });
  });

  test("assigned substitute (non-owner) → allowed as peer", async () => {
    r.findParentById.mockResolvedValue({ ...parent, type: "SHIFT", userId: 999 });
    r.findSubstituteByParent.mockResolvedValue({
      id: 1,
      scheduleChangeRequestId: 10,
      userId: STAFF.id,
    });
    const out = await svc.getChangeRequestDetail(10, STAFF);
    expect(out.substitute).toMatchObject({ userId: STAFF.id });
  });
});

describe("peer actions", () => {
  test("peerAccept: missing request → NOT_FOUND", async () => {
    r.findParentById.mockResolvedValue(undefined);
    await expect(svc.peerAccept(10, 8)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  describe("SWAP", () => {
    beforeEach(() => {
      r.findParentById.mockResolvedValue({ ...parent, type: "SWAP" });
      r.findSwapByParent.mockResolvedValue({ peerUserId: 8 } as never);
    });

    test("peerAccept: caller is not the peer → FORBIDDEN", async () => {
      await expect(svc.peerAccept(10, 99)).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    test("peerAccept: stale state → CONFLICT", async () => {
      r.markPeerAccepted.mockResolvedValue(undefined);
      await expect(svc.peerAccept(10, 8)).rejects.toMatchObject({ code: "CONFLICT" });
    });

    test("peerAccept: ok → returns updated row", async () => {
      r.markPeerAccepted.mockResolvedValue({ ...parent, status: "PENDING" });
      const out = await svc.peerAccept(10, 8);
      expect(out.status).toBe("PENDING");
    });

    test("peerReject: ok → marks rejected with reason", async () => {
      r.markPeerRejected.mockResolvedValue({ ...parent, status: "REJECT", rejectReason: "불가" });
      const out = await svc.peerReject(10, 8, "불가");
      expect(r.markPeerRejected).toHaveBeenCalledWith(10, "불가", expect.anything());
      expect(out.status).toBe("REJECT");
    });
  });

  describe("SHIFT (substitute)", () => {
    beforeEach(() => {
      r.findParentById.mockResolvedValue({ ...parent, type: "SHIFT" });
      r.findSubstituteByParent.mockResolvedValue({ userId: 8 } as never);
    });

    test("peerAccept: caller is not the assigned substitute → FORBIDDEN", async () => {
      await expect(svc.peerAccept(10, 99)).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    test("peerAccept: ok → returns updated row", async () => {
      r.markPeerAccepted.mockResolvedValue({ ...parent, type: "SHIFT", status: "PENDING" });
      const out = await svc.peerAccept(10, 8);
      expect(out.status).toBe("PENDING");
    });

    test("peerReject: ok → marks rejected with reason", async () => {
      r.markPeerRejected.mockResolvedValue({
        ...parent,
        type: "SHIFT",
        status: "REJECT",
        rejectReason: "불가",
      });
      const out = await svc.peerReject(10, 8, "불가");
      expect(r.markPeerRejected).toHaveBeenCalledWith(10, "불가", expect.anything());
      expect(out.status).toBe("REJECT");
    });
  });

  test("peerAccept: TIME_ADJUST has no peer → NOT_FOUND", async () => {
    r.findParentById.mockResolvedValue({ ...parent, type: "TIME_ADJUST" });
    await expect(svc.peerAccept(10, 8)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
