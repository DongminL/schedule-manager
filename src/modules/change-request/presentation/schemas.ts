import { z } from "zod";

import { CHANGE_TYPES, REQUEST_STATUS } from "@/core/db/schema";
import { dateString, idParam, instant } from "@/core/validation/primitives";

const targetRef = z
  .object({
    targetDefaultScheduleId: idParam.optional(),
    targetUpdatedScheduleId: idParam.optional(),
  })
  .refine(
    (v) =>
      (v.targetDefaultScheduleId === undefined) !== (v.targetUpdatedScheduleId === undefined),
    {
      message:
        "대상 근무는 targetDefaultScheduleId 또는 targetUpdatedScheduleId 중 하나만 지정하세요.",
    },
  );

const baseChangeFields = {
  updateDate: dateString,
  startAt: instant,
  endAt: instant,
  reason: z.string().trim().min(1).max(500),
};

export const createTimeAdjustSchema = z
  .object({
    type: z.literal("TIME_ADJUST"),
    ...baseChangeFields,
    adjustStartAt: instant,
    adjustEndAt: instant,
  })
  .and(targetRef)
  .refine((v) => v.adjustEndAt > v.adjustStartAt, {
    message: "조정 종료 시간이 시작 시간보다 빠릅니다.",
  });

export const createSubstituteSchema = z
  .object({
    type: z.literal("SHIFT"),
    ...baseChangeFields,
    substituteUserId: idParam,
  })
  .and(targetRef);

export const createSwapSchema = z
  .object({
    type: z.literal("SWAP"),
    ...baseChangeFields,
    peerUserId: idParam,
    peerUpdateDate: dateString,
    peerStartAt: instant,
    peerEndAt: instant,
    peerTargetDefaultScheduleId: idParam.optional(),
    peerTargetUpdatedScheduleId: idParam.optional(),
  })
  .and(targetRef)
  .refine(
    (v) =>
      (v.peerTargetDefaultScheduleId === undefined) !==
      (v.peerTargetUpdatedScheduleId === undefined),
    {
      message:
        "상대 근무는 peerTargetDefaultScheduleId 또는 peerTargetUpdatedScheduleId 중 하나만 지정하세요.",
    },
  );

/** Parse a change-request body by its `type`. */
export function parseChangeRequest(raw: unknown) {
  const head = z.object({ type: z.enum(CHANGE_TYPES) }).parse(raw);
  switch (head.type) {
    case "TIME_ADJUST":
      return createTimeAdjustSchema.parse(raw);
    case "SHIFT":
      return createSubstituteSchema.parse(raw);
    case "SWAP":
      return createSwapSchema.parse(raw);
  }
}

export const rejectSchema = z.object({
  rejectReason: z.string().trim().min(1, "거절 사유는 필수입니다.").max(500),
  version: z.number().int().nonnegative().optional(),
});

export const peerRejectSchema = z.object({
  reason: z.string().trim().min(1, "거절 사유는 필수입니다.").max(500),
});

export const approveSchema = z.object({
  version: z.number().int().nonnegative().optional(),
});

/* ----------------------------------------------------- response DTOs -- */

/** A change-request row as returned by the API (timestamps are ISO strings,
 *  `updateDate` is YYYY-MM-DD). */
export const changeRequestResponse = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  approveBy: z.number().int().nullable(),
  type: z.enum(CHANGE_TYPES),
  updateDate: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  targetDefaultScheduleId: z.number().int().nullable(),
  targetUpdatedScheduleId: z.number().int().nullable(),
  reason: z.string(),
  rejectReason: z.string().nullable(),
  status: z.enum(REQUEST_STATUS),
  peerAcceptedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  version: z.number().int(),
});

export const changeRequestListResponse = z.array(changeRequestResponse);

export const changeRequestDetailResponse = changeRequestResponse.extend({
  substitute: z
    .object({
      id: z.number().int(),
      scheduleChangeRequestId: z.number().int(),
      userId: z.number().int(),
    })
    .nullable(),
  swap: z
    .object({
      id: z.number().int(),
      scheduleChangeRequestId: z.number().int(),
      peerUserId: z.number().int(),
      swapDate: z.string(),
      startAt: z.string(),
      endAt: z.string(),
      peerTargetDefaultScheduleId: z.number().int().nullable(),
      peerTargetUpdatedScheduleId: z.number().int().nullable(),
    })
    .nullable(),
  timeAdjust: z
    .object({
      id: z.number().int(),
      scheduleChangeRequestId: z.number().int(),
      adjustStartAt: z.string(),
      adjustEndAt: z.string(),
    })
    .nullable(),
});
