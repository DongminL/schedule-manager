import { Errors, ok, parseIdParam, readJson, route } from "@/core/http/envelope";
import { kstToday } from "@/core/time/kst";
import { dateString } from "@/core/validation/primitives";
import {
  requireActiveManager,
  requireManager,
  requireUser,
} from "@/modules/auth/presentation/guards";

import { getCalendar } from "../application/calendarService";
import {
  createDefaultSchedule,
  endDefaultSchedule,
  listDefaultSchedules,
  managerEditSchedule,
  updateDefaultSchedule,
} from "../application/schedulingService";
import {
  createDefaultScheduleSchema,
  managerEditSchema,
  scheduleQuerySchema,
  updateDefaultScheduleSchema,
} from "./schemas";

type StaffCtx = { params: Promise<{ id: string }> };
type PatternCtx = { params: Promise<{ id: string; sid: string }> };

const positiveInt = parseIdParam;

/* calendar */

export const getCalendarHandler = route(async (req) => {
  const session = await requireUser();
  const url = new URL(req.url);
  const query = scheduleQuerySchema.parse({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    userId: url.searchParams.get("userId") ?? undefined,
  });
  const result = await getCalendar({
    ...query,
    viewerRole: session.role,
    viewerId: session.id,
  });
  return ok(result, { headers: { "Cache-Control": "private, max-age=60" } });
});

export const managerEditHandler = route(async (req) => {
  await requireActiveManager();
  const input = await readJson(req, managerEditSchema);
  const { affectedMonths } = await managerEditSchedule(input);
  return ok({ ok: true, affectedMonths });
});

/* default schedules */

export const listDefaultSchedulesHandler = route<StaffCtx>(async (_req, ctx) => {
  await requireManager();
  const userId = positiveInt((await ctx.params).id, "직원 ID");
  return ok(await listDefaultSchedules(userId));
});

export const createDefaultScheduleHandler = route<StaffCtx>(async (req, ctx) => {
  await requireManager();
  const userId = positiveInt((await ctx.params).id, "직원 ID");
  const input = await readJson(req, createDefaultScheduleSchema);
  return ok(await createDefaultSchedule(userId, input), { status: 201 });
});

export const updateDefaultScheduleHandler = route<PatternCtx>(async (req, ctx) => {
  await requireManager();
  const sid = positiveInt((await ctx.params).sid, "스케줄 ID");
  const input = await readJson(req, updateDefaultScheduleSchema);
  return ok(await updateDefaultSchedule(sid, input));
});

export const endDefaultScheduleHandler = route<PatternCtx>(async (req, ctx) => {
  await requireManager();
  const sid = positiveInt((await ctx.params).sid, "스케줄 ID");
  const endDate = new URL(req.url).searchParams.get("endDate") ?? kstToday();
  if (!dateString.safeParse(endDate).success) {
    throw Errors.badRequest("endDate는 YYYY-MM-DD여야 합니다.");
  }
  return ok(await endDefaultSchedule(sid, endDate));
});
