import type { ChangeType } from "@/core/db/schema";

/** Exactly one of targetDefaultScheduleId / targetUpdatedScheduleId is set. */
export interface TargetRef {
  targetDefaultScheduleId?: number;
  targetUpdatedScheduleId?: number;
}

export interface CreateChangeRequestBase extends TargetRef {
  type: ChangeType;
  updateDate: string;
  startAt: Date;
  endAt: Date;
  reason: string;
}

export interface CreateTimeAdjustInput extends CreateChangeRequestBase {
  type: "TIME_ADJUST";
  adjustStartAt: Date;
  adjustEndAt: Date;
}

export interface CreateSubstituteInput extends CreateChangeRequestBase {
  type: "SHIFT";
  substituteUserId: number;
}

export interface CreateSwapInput extends CreateChangeRequestBase {
  type: "SWAP";
  peerUserId: number;
  peerUpdateDate: string;
  peerStartAt: Date;
  peerEndAt: Date;
  peerTargetDefaultScheduleId?: number;
  peerTargetUpdatedScheduleId?: number;
}

export type CreateChangeRequestInput =
  | CreateTimeAdjustInput
  | CreateSubstituteInput
  | CreateSwapInput;
