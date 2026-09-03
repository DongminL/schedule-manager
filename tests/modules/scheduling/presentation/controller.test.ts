/** Presentation-layer tests for the scheduling context. Services + guards mocked. */
jest.mock("@/modules/auth/presentation/guards", () => ({
  requireUser: jest.fn(),
  requireManager: jest.fn(),
  requireActiveUser: jest.fn(),
  requireActiveManager: jest.fn(),
}));
jest.mock("@/modules/scheduling/application/calendarService", () => ({
  getCalendar: jest.fn(),
}));
jest.mock("@/modules/scheduling/application/schedulingService", () => ({
  listDefaultSchedules: jest.fn(),
  createDefaultSchedule: jest.fn(),
  updateDefaultSchedule: jest.fn(),
  endDefaultSchedule: jest.fn(),
  managerEditSchedule: jest.fn(),
}));

import { Errors } from "@/core/http/envelope";
import * as guards from "@/modules/auth/presentation/guards";
import * as calendarService from "@/modules/scheduling/application/calendarService";
import * as schedulingService from "@/modules/scheduling/application/schedulingService";
import {
  createDefaultScheduleHandler,
  endDefaultScheduleHandler,
  getCalendarHandler,
  listDefaultSchedulesHandler,
  managerEditHandler,
  updateDefaultScheduleHandler,
} from "@/modules/scheduling/presentation/controller";
import {
  calendarResponse,
  defaultScheduleListResponse,
  defaultScheduleResponse,
  managerEditResponse,
} from "@/modules/scheduling/presentation/schemas";

import { expectFail, expectOk, jsonRequest, routeCtx } from "../../../helpers/api";

const g = guards as jest.Mocked<typeof guards>;
const cal = calendarService as jest.Mocked<typeof calendarService>;
const sched = schedulingService as jest.Mocked<typeof schedulingService>;

const MANAGER = { id: 1, role: "MANAGER" as const, name: "점장", mustChangePassword: false };
const STAFF = { id: 5, role: "STAFF" as const, name: "알바", mustChangePassword: false };

const calendarResult = {
  from: "2026-03-01",
  to: "2026-03-31",
  userId: null,
  shifts: [
    {
      userId: 5,
      date: "2026-03-10",
      startAt: "2026-03-10T00:00:00.000Z",
      endAt: "2026-03-10T04:00:00.000Z",
      source: "DEFAULT" as const,
      defaultScheduleId: 1,
      updatedScheduleId: null,
    },
  ],
};

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

beforeEach(() => {
  g.requireUser.mockResolvedValue(MANAGER);
  g.requireManager.mockResolvedValue(MANAGER);
  g.requireActiveManager.mockResolvedValue(MANAGER);
});

describe("GET /api/schedules", () => {
  test("valid range → 200, matches schema + sends Cache-Control", async () => {
    cal.getCalendar.mockResolvedValue(calendarResult);
    const res = await getCalendarHandler(
      jsonRequest("/api/schedules?from=2026-03-01&to=2026-03-31"),
      undefined as never,
    );
    await expectOk(res, calendarResponse);
    expect(res.headers.get("cache-control")).toBe("private, max-age=60");
    expect(cal.getCalendar).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "2026-03-01",
        to: "2026-03-31",
        viewerRole: "MANAGER",
        viewerId: 1,
      }),
    );
  });

  test("STAFF viewer forwards own role/id", async () => {
    g.requireUser.mockResolvedValue(STAFF);
    cal.getCalendar.mockResolvedValue({ ...calendarResult, userId: 5 });
    await getCalendarHandler(
      jsonRequest("/api/schedules?from=2026-03-01&to=2026-03-31"),
      undefined as never,
    );
    expect(cal.getCalendar).toHaveBeenCalledWith(
      expect.objectContaining({ viewerRole: "STAFF", viewerId: 5 }),
    );
  });

  test("missing from → 422", async () => {
    const res = await getCalendarHandler(
      jsonRequest("/api/schedules?to=2026-03-31"),
      undefined as never,
    );
    await expectFail(res, "VALIDATION", 422);
    expect(cal.getCalendar).not.toHaveBeenCalled();
  });

  test("to before from → 422", async () => {
    const res = await getCalendarHandler(
      jsonRequest("/api/schedules?from=2026-03-31&to=2026-03-01"),
      undefined as never,
    );
    await expectFail(res, "VALIDATION", 422);
  });
});

describe("POST /api/schedules/manager-edit", () => {
  test("ADD → 200", async () => {
    sched.managerEditSchedule.mockResolvedValue({ affectedMonths: ["2026-03"] });
    const res = await managerEditHandler(
      jsonRequest("/api/schedules/manager-edit", {
        body: {
          kind: "ADD",
          userId: 5,
          updateDate: "2026-03-10",
          startAt: "2026-03-10T09:00:00+09:00",
          endAt: "2026-03-10T13:00:00+09:00",
        },
      }),
      undefined as never,
    );
    await expectOk(res, managerEditResponse);
  });

  test("unknown kind → 422", async () => {
    const res = await managerEditHandler(
      jsonRequest("/api/schedules/manager-edit", { body: { kind: "NOPE" } }),
      undefined as never,
    );
    await expectFail(res, "VALIDATION", 422);
  });

  test("non-manager → 403", async () => {
    g.requireActiveManager.mockRejectedValue(Errors.forbidden());
    const res = await managerEditHandler(
      jsonRequest("/api/schedules/manager-edit", {
        body: { kind: "CANCEL", defaultScheduleId: 1, updateDate: "2026-03-10" },
      }),
      undefined as never,
    );
    await expectFail(res, "FORBIDDEN", 403);
  });
});

describe("/api/staff/[id]/default-schedules", () => {
  test("GET list → 200", async () => {
    sched.listDefaultSchedules.mockResolvedValue([patternRow]);
    const res = await listDefaultSchedulesHandler(
      jsonRequest("/api/staff/5/default-schedules"),
      routeCtx({ id: "5" }),
    );
    const data = await expectOk(res, defaultScheduleListResponse);
    expect(data).toHaveLength(1);
    expect(sched.listDefaultSchedules).toHaveBeenCalledWith(5);
  });

  test("POST create → 201", async () => {
    sched.createDefaultSchedule.mockResolvedValue(patternRow);
    const res = await createDefaultScheduleHandler(
      jsonRequest("/api/staff/5/default-schedules", {
        body: {
          dayOfWeek: "MON",
          startHhmm: "09:00",
          endHhmm: "13:00",
          startDate: "2026-01-01",
        },
      }),
      routeCtx({ id: "5" }),
    );
    await expectOk(res, defaultScheduleResponse, 201);
    expect(sched.createDefaultSchedule).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ dayOfWeek: "MON", startHhmm: "09:00" }),
    );
  });

  test("PATCH → 200", async () => {
    sched.updateDefaultSchedule.mockResolvedValue({ ...patternRow, dayOfWeek: "TUE" });
    const res = await updateDefaultScheduleHandler(
      jsonRequest("/api/staff/5/default-schedules/1", {
        method: "PATCH",
        body: { dayOfWeek: "TUE" },
      }),
      routeCtx({ id: "5", sid: "1" }),
    );
    const data = await expectOk(res, defaultScheduleResponse);
    expect(data.dayOfWeek).toBe("TUE");
  });

  test("DELETE (end recurrence) → 200", async () => {
    sched.endDefaultSchedule.mockResolvedValue({ ...patternRow, endDate: "2026-04-01" });
    const res = await endDefaultScheduleHandler(
      jsonRequest("/api/staff/5/default-schedules/1?endDate=2026-04-01", { method: "DELETE" }),
      routeCtx({ id: "5", sid: "1" }),
    );
    const data = await expectOk(res, defaultScheduleResponse);
    expect(sched.endDefaultSchedule).toHaveBeenCalledWith(1, "2026-04-01");
    expect(data.endDate).toBe("2026-04-01");
  });

  test("DELETE with bad endDate → 400", async () => {
    const res = await endDefaultScheduleHandler(
      jsonRequest("/api/staff/5/default-schedules/1?endDate=nope", { method: "DELETE" }),
      routeCtx({ id: "5", sid: "1" }),
    );
    await expectFail(res, "BAD_REQUEST", 400);
  });
});
