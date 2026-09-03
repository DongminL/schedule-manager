/** Presentation-layer tests for the change-request context. Services + guards mocked. */
jest.mock("@/modules/auth/presentation/guards", () => ({
  requireUser: jest.fn(),
  requireManager: jest.fn(),
  requireActiveUser: jest.fn(),
  requireActiveManager: jest.fn(),
}));
jest.mock("@/modules/change-request/application/changeRequestService", () => ({
  createChangeRequest: jest.fn(),
  listChangeRequests: jest.fn(),
  getChangeRequestDetail: jest.fn(),
  peerAccept: jest.fn(),
  peerReject: jest.fn(),
}));
jest.mock("@/modules/change-request/application/approvalService", () => ({
  approveChangeRequest: jest.fn(),
  rejectChangeRequest: jest.fn(),
}));

import { Errors } from "@/core/http/envelope";
import * as guards from "@/modules/auth/presentation/guards";
import * as approvalService from "@/modules/change-request/application/approvalService";
import * as changeRequestService from "@/modules/change-request/application/changeRequestService";
import {
  approveHandler,
  createHandler,
  detailHandler,
  listHandler,
  peerAcceptHandler,
  peerRejectHandler,
  rejectHandler,
} from "@/modules/change-request/presentation/controller";
import {
  changeRequestDetailResponse,
  changeRequestListResponse,
  changeRequestResponse,
} from "@/modules/change-request/presentation/schemas";

import { expectFail, expectOk, jsonRequest, routeCtx } from "../../../helpers/api";

const g = guards as jest.Mocked<typeof guards>;
const crs = changeRequestService as jest.Mocked<typeof changeRequestService>;
const approval = approvalService as jest.Mocked<typeof approvalService>;

const MANAGER = { id: 1, role: "MANAGER" as const, name: "점장", mustChangePassword: false };
const STAFF = { id: 5, role: "STAFF" as const, name: "알바", mustChangePassword: false };

const row = {
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
  createdAt: new Date("2026-03-01T00:00:00Z"),
  updatedAt: new Date("2026-03-01T00:00:00Z"),
  deletedAt: null as Date | null,
  version: 1,
};

beforeEach(() => {
  g.requireActiveUser.mockResolvedValue(STAFF);
  g.requireActiveManager.mockResolvedValue(MANAGER);
});

describe("GET /api/schedule-changes", () => {
  test("→ 200 list", async () => {
    crs.listChangeRequests.mockResolvedValue([row]);
    const res = await listHandler(jsonRequest("/api/schedule-changes"), undefined as never);
    const data = await expectOk(res, changeRequestListResponse);
    expect(data).toHaveLength(1);
    expect(crs.listChangeRequests).toHaveBeenCalledWith(STAFF, undefined);
  });

  test("?status=PENDING is forwarded", async () => {
    crs.listChangeRequests.mockResolvedValue([]);
    await listHandler(jsonRequest("/api/schedule-changes?status=PENDING"), undefined as never);
    expect(crs.listChangeRequests).toHaveBeenCalledWith(STAFF, "PENDING");
  });

  test("junk status is ignored (undefined)", async () => {
    crs.listChangeRequests.mockResolvedValue([]);
    await listHandler(jsonRequest("/api/schedule-changes?status=WAT"), undefined as never);
    expect(crs.listChangeRequests).toHaveBeenCalledWith(STAFF, undefined);
  });
});

describe("POST /api/schedule-changes", () => {
  const validTimeAdjust = {
    type: "TIME_ADJUST",
    updateDate: "2026-03-10",
    startAt: "2026-03-10T09:00:00+09:00",
    endAt: "2026-03-10T13:00:00+09:00",
    reason: "지각",
    adjustStartAt: "2026-03-10T10:00:00+09:00",
    adjustEndAt: "2026-03-10T14:00:00+09:00",
    targetDefaultScheduleId: 1,
  };

  test("valid TIME_ADJUST → 201", async () => {
    crs.createChangeRequest.mockResolvedValue(row);
    const res = await createHandler(
      jsonRequest("/api/schedule-changes", { body: validTimeAdjust }),
      undefined as never,
    );
    await expectOk(res, changeRequestResponse, 201);
    expect(crs.createChangeRequest).toHaveBeenCalledWith(
      STAFF.id,
      expect.objectContaining({ type: "TIME_ADJUST", targetDefaultScheduleId: 1 }),
    );
  });

  test("adjustEnd before adjustStart → 422", async () => {
    const res = await createHandler(
      jsonRequest("/api/schedule-changes", {
        body: { ...validTimeAdjust, adjustEndAt: "2026-03-10T09:00:00+09:00" },
      }),
      undefined as never,
    );
    await expectFail(res, "VALIDATION", 422);
    expect(crs.createChangeRequest).not.toHaveBeenCalled();
  });

  test("unknown type → 422", async () => {
    const res = await createHandler(
      jsonRequest("/api/schedule-changes", { body: { type: "NOPE" } }),
      undefined as never,
    );
    await expectFail(res, "VALIDATION", 422);
  });

  test("both target refs set → 422", async () => {
    const res = await createHandler(
      jsonRequest("/api/schedule-changes", {
        body: { ...validTimeAdjust, targetUpdatedScheduleId: 2 },
      }),
      undefined as never,
    );
    await expectFail(res, "VALIDATION", 422);
  });
});

describe("GET /api/schedule-changes/[id]", () => {
  test("→ 200 detail", async () => {
    crs.getChangeRequestDetail.mockResolvedValue({
      ...row,
      substitute: null,
      swap: null,
      timeAdjust: {
        id: 1,
        scheduleChangeRequestId: 10,
        adjustStartAt: new Date("2026-03-10T01:00:00Z"),
        adjustEndAt: new Date("2026-03-10T05:00:00Z"),
      },
    });
    const res = await detailHandler(
      jsonRequest("/api/schedule-changes/10"),
      routeCtx({ id: "10" }),
    );
    const data = await expectOk(res, changeRequestDetailResponse);
    expect(data.timeAdjust?.adjustStartAt).toBe("2026-03-10T01:00:00.000Z");
  });

  test("not found → 404", async () => {
    crs.getChangeRequestDetail.mockRejectedValue(Errors.notFound("변경 요청"));
    const res = await detailHandler(
      jsonRequest("/api/schedule-changes/999"),
      routeCtx({ id: "999" }),
    );
    await expectFail(res, "NOT_FOUND", 404);
  });
});

describe("peer actions", () => {
  test("POST /[id]/peer-accept → 200", async () => {
    crs.peerAccept.mockResolvedValue({ ...row, status: "PENDING", peerAcceptedAt: new Date() });
    const res = await peerAcceptHandler(
      jsonRequest("/api/schedule-changes/10/peer-accept", { method: "POST" }),
      routeCtx({ id: "10" }),
    );
    await expectOk(res, changeRequestResponse);
    expect(crs.peerAccept).toHaveBeenCalledWith(10, STAFF.id);
  });

  test("POST /[id]/peer-reject with reason → 200", async () => {
    crs.peerReject.mockResolvedValue({ ...row, status: "REJECT", rejectReason: "불가" });
    const res = await peerRejectHandler(
      jsonRequest("/api/schedule-changes/10/peer-reject", { body: { reason: "불가" } }),
      routeCtx({ id: "10" }),
    );
    const data = await expectOk(res, changeRequestResponse);
    expect(data.status).toBe("REJECT");
  });

  test("peer-reject without reason → 422", async () => {
    const res = await peerRejectHandler(
      jsonRequest("/api/schedule-changes/10/peer-reject", { body: {} }),
      routeCtx({ id: "10" }),
    );
    await expectFail(res, "VALIDATION", 422);
  });
});

describe("manager approve / reject", () => {
  test("POST /[id]/approve → 200", async () => {
    approval.approveChangeRequest.mockResolvedValue({
      request: { ...row, status: "APPROVAL", approveBy: 1, version: 2 },
      affectedMonths: ["2026-03"],
    });
    const res = await approveHandler(
      jsonRequest("/api/schedule-changes/10/approve", { method: "POST" }),
      routeCtx({ id: "10" }),
    );
    const data = await expectOk(res, changeRequestResponse);
    expect(data.status).toBe("APPROVAL");
    expect(approval.approveChangeRequest).toHaveBeenCalledWith(1, 10, undefined);
  });

  test("approve version conflict → 409", async () => {
    approval.approveChangeRequest.mockRejectedValue(Errors.versionConflict());
    const res = await approveHandler(
      jsonRequest("/api/schedule-changes/10/approve", {
        method: "POST",
        body: { version: 1 },
      }),
      routeCtx({ id: "10" }),
    );
    await expectFail(res, "VERSION_CONFLICT", 409);
  });

  test("POST /[id]/reject with reason → 200", async () => {
    approval.rejectChangeRequest.mockResolvedValue({
      ...row,
      status: "REJECT",
      rejectReason: "인력부족",
      approveBy: 1,
    });
    const res = await rejectHandler(
      jsonRequest("/api/schedule-changes/10/reject", { body: { rejectReason: "인력부족" } }),
      routeCtx({ id: "10" }),
    );
    const data = await expectOk(res, changeRequestResponse);
    expect(data.status).toBe("REJECT");
  });

  test("reject without reason → 422", async () => {
    const res = await rejectHandler(
      jsonRequest("/api/schedule-changes/10/reject", { body: {} }),
      routeCtx({ id: "10" }),
    );
    await expectFail(res, "VALIDATION", 422);
  });

  test("reject as non-manager → 403", async () => {
    g.requireActiveManager.mockRejectedValue(Errors.forbidden());
    const res = await rejectHandler(
      jsonRequest("/api/schedule-changes/10/reject", { body: { rejectReason: "x" } }),
      routeCtx({ id: "10" }),
    );
    await expectFail(res, "FORBIDDEN", 403);
  });
});
