/**
 * Presentation-layer tests for the account context. The application service and
 * auth guards are mocked; the real `route()` wrapper, `Errors`, and response
 * schemas run. A response whose shape drifts from its declared schema fails here.
 */
jest.mock("@/modules/auth/presentation/guards", () => ({
  requireUser: jest.fn(),
  requireManager: jest.fn(),
  requireActiveUser: jest.fn(),
  requireActiveManager: jest.fn(),
}));
jest.mock("@/modules/account/application/accountService", () => ({
  listStaff: jest.fn(),
  getStaff: jest.fn(),
  createStaff: jest.fn(),
  updateStaff: jest.fn(),
  deactivateStaff: jest.fn(),
  changePassword: jest.fn(),
}));

import { Errors } from "@/core/http/envelope";
import * as svc from "@/modules/account/application/accountService";
import * as guards from "@/modules/auth/presentation/guards";
import {
  changePasswordHandler,
  createStaffHandler,
  deactivateStaffHandler,
  getStaffHandler,
  listStaffHandler,
  updateStaffHandler,
} from "@/modules/account/presentation/controller";
import {
  changePasswordResponse,
  publicUserResponse,
  staffListResponse,
} from "@/modules/account/presentation/schemas";

import { expectFail, expectOk, jsonRequest, routeCtx } from "../../../helpers/api";

const g = guards as jest.Mocked<typeof guards>;
const s = svc as jest.Mocked<typeof svc>;

const MANAGER = { id: 1, role: "MANAGER" as const, name: "점장", mustChangePassword: false };

const sampleUser = {
  id: 2,
  phoneNumber: "01000000000",
  name: "알바",
  role: "STAFF" as const,
  color: "#cccccc",
  isActive: true,
  mustChangePassword: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

beforeEach(() => {
  g.requireManager.mockResolvedValue(MANAGER);
  g.requireUser.mockResolvedValue(MANAGER);
});

describe("GET /api/staff", () => {
  test("MANAGER → 200, list matches schema", async () => {
    s.listStaff.mockResolvedValue([sampleUser]);
    const res = await listStaffHandler(jsonRequest("/api/staff"), undefined as never);
    const data = await expectOk(res, staffListResponse);
    expect(data).toHaveLength(1);
    expect(s.listStaff).toHaveBeenCalledWith(false);
  });

  test("no session → 401", async () => {
    g.requireManager.mockRejectedValue(Errors.unauthorized());
    const res = await listStaffHandler(jsonRequest("/api/staff"), undefined as never);
    await expectFail(res, "UNAUTHORIZED", 401);
  });

  test("STAFF → 403", async () => {
    g.requireManager.mockRejectedValue(Errors.forbidden());
    const res = await listStaffHandler(jsonRequest("/api/staff"), undefined as never);
    await expectFail(res, "FORBIDDEN", 403);
  });

  test("?includeInactive=true is forwarded", async () => {
    s.listStaff.mockResolvedValue([]);
    await listStaffHandler(
      jsonRequest("/api/staff?includeInactive=true"),
      undefined as never,
    );
    expect(s.listStaff).toHaveBeenCalledWith(true);
  });
});

describe("POST /api/staff", () => {
  test("valid body → 201", async () => {
    s.createStaff.mockResolvedValue(sampleUser);
    const res = await createStaffHandler(
      jsonRequest("/api/staff", { body: { name: "알바", phoneNumber: "01011112222" } }),
      undefined as never,
    );
    await expectOk(res, publicUserResponse, 201);
    expect(s.createStaff).toHaveBeenCalledWith({ name: "알바", phoneNumber: "01011112222" });
  });

  test("missing name → 422, service not called", async () => {
    const res = await createStaffHandler(
      jsonRequest("/api/staff", { body: { phoneNumber: "01011112222" } }),
      undefined as never,
    );
    await expectFail(res, "VALIDATION", 422);
    expect(s.createStaff).not.toHaveBeenCalled();
  });

  test("duplicate phone → 409", async () => {
    s.createStaff.mockRejectedValue(Errors.conflict("이미 등록된 휴대폰 번호입니다."));
    const res = await createStaffHandler(
      jsonRequest("/api/staff", { body: { name: "알바", phoneNumber: "01011112222" } }),
      undefined as never,
    );
    await expectFail(res, "CONFLICT", 409);
  });
});

describe("/api/staff/[id]", () => {
  test("GET → 200", async () => {
    s.getStaff.mockResolvedValue(sampleUser);
    const res = await getStaffHandler(jsonRequest("/api/staff/2"), routeCtx({ id: "2" }));
    await expectOk(res, publicUserResponse);
    expect(s.getStaff).toHaveBeenCalledWith(2);
  });

  test("PATCH → 200", async () => {
    s.updateStaff.mockResolvedValue({ ...sampleUser, name: "새이름" });
    const res = await updateStaffHandler(
      jsonRequest("/api/staff/2", { method: "PATCH", body: { name: "새이름" } }),
      routeCtx({ id: "2" }),
    );
    const data = await expectOk(res, publicUserResponse);
    expect(data.name).toBe("새이름");
  });

  test("DELETE (soft) → 200", async () => {
    s.deactivateStaff.mockResolvedValue({ ...sampleUser, isActive: false });
    const res = await deactivateStaffHandler(
      jsonRequest("/api/staff/2", { method: "DELETE" }),
      routeCtx({ id: "2" }),
    );
    const data = await expectOk(res, publicUserResponse);
    expect(data.isActive).toBe(false);
  });

  test("non-numeric id → 400", async () => {
    const res = await getStaffHandler(jsonRequest("/api/staff/abc"), routeCtx({ id: "abc" }));
    await expectFail(res, "BAD_REQUEST", 400);
  });
});

describe("POST /api/account/change-password", () => {
  test("valid (mustChangePassword session) → 200, no current password", async () => {
    g.requireUser.mockResolvedValue({ ...MANAGER, mustChangePassword: true });
    s.changePassword.mockResolvedValue(undefined);
    const res = await changePasswordHandler(
      jsonRequest("/api/account/change-password", {
        body: { newPassword: "newpass12" },
      }),
      undefined as never,
    );
    await expectOk(res, changePasswordResponse);
    expect(s.changePassword).toHaveBeenCalledWith(MANAGER.id, "newpass12");
  });

  test("session flag already cleared → 400", async () => {
    // beforeEach sets requireUser → MANAGER (mustChangePassword: false)
    const res = await changePasswordHandler(
      jsonRequest("/api/account/change-password", {
        body: { newPassword: "newpass12" },
      }),
      undefined as never,
    );
    await expectFail(res, "BAD_REQUEST", 400);
    expect(s.changePassword).not.toHaveBeenCalled();
  });
});
