import { z } from "zod";

import { DAYS_OF_WEEK } from "@/core/db/schema";
import { dateString, hhmm, idParam, instant } from "@/core/validation/primitives";

export const scheduleQuerySchema = z
  .object({
    from: dateString,
    to: dateString,
    userId: idParam.optional(),
  })
  .refine((v) => v.to >= v.from, { message: "to는 from보다 빠를 수 없습니다.", path: ["to"] })
  .refine(
    (v) => {
      const days =
        (Date.parse(`${v.to}T00:00:00Z`) - Date.parse(`${v.from}T00:00:00Z`)) / 86_400_000;
      return days <= 92;
    },
    { message: "조회 범위는 최대 92일입니다.", path: ["to"] },
  );

export const createDefaultScheduleSchema = z
  .object({
    dayOfWeek: z.enum(DAYS_OF_WEEK),
    startHhmm: hhmm,
    endHhmm: hhmm,
    startDate: dateString,
    endDate: dateString.nullish(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: "반복 종료일은 시작일보다 빠를 수 없습니다.",
    path: ["endDate"],
  });

export const updateDefaultScheduleSchema = z
  .object({
    dayOfWeek: z.enum(DAYS_OF_WEEK).optional(),
    startHhmm: hhmm.optional(),
    endHhmm: hhmm.optional(),
    startDate: dateString.optional(),
    endDate: dateString.nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "수정할 값이 없습니다." });

export const managerEditSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ADD"),
    userId: idParam,
    updateDate: dateString,
    startAt: instant,
    endAt: instant,
  }),
  z.object({
    kind: z.literal("MODIFY"),
    defaultScheduleId: idParam,
    updateDate: dateString,
    startAt: instant,
    endAt: instant,
  }),
  z.object({
    kind: z.literal("CANCEL"),
    defaultScheduleId: idParam,
    updateDate: dateString,
  }),
]);

/* ----------------------------------------------------- response DTOs -- */

export const calendarShiftResponse = z.object({
  userId: z.number().int(),
  date: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  source: z.enum(["DEFAULT", "UPDATED_MODIFY", "UPDATED_ADD"]),
  defaultScheduleId: z.number().int().nullable(),
  updatedScheduleId: z.number().int().nullable(),
});

export const calendarResponse = z.object({
  from: z.string(),
  to: z.string(),
  userId: z.number().int().nullable(),
  shifts: z.array(calendarShiftResponse),
});

export const managerEditResponse = z.object({
  ok: z.literal(true),
  affectedMonths: z.array(z.string()),
});

/** A recurring-pattern row as returned by the API (timestamps are ISO strings,
 *  `startDate`/`endDate` are YYYY-MM-DD). */
export const defaultScheduleResponse = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  dayOfWeek: z.enum(DAYS_OF_WEEK),
  startTime: z.string(),
  endTime: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const defaultScheduleListResponse = z.array(defaultScheduleResponse);
