import type { OverrideKind } from "@/core/db/schema";
import type { TargetShift } from "@/modules/scheduling/domain/scheduleResolver";

export type { TargetShift };

export type OverrideOp =
  | {
      op: "INSERT_UPDATED";
      userId: number;
      defaultScheduleId: number | null;
      kind: OverrideKind;
      updateDate: string;
      startAt: Date;
      endAt: Date;
    }
  | { op: "SOFT_DELETE_UPDATED"; updatedScheduleId: number }
  | {
      op: "SET_UPDATED";
      updatedScheduleId: number;
      kind?: OverrideKind;
      startAt?: Date;
      endAt?: Date;
    };

export type ApprovalPlanInput =
  | {
      type: "TIME_ADJUST";
      requesterId: number;
      target: TargetShift;
      adjustStartAt: Date;
      adjustEndAt: Date;
    }
  | {
      type: "SHIFT";
      requesterId: number;
      target: TargetShift;
      substituteUserId: number;
    }
  | {
      type: "SWAP";
      requesterId: number;
      target: TargetShift;
      peerUserId: number;
      peerTarget: TargetShift;
    };

function cancelOccurrence(userId: number, t: TargetShift): OverrideOp[] {
  if (t.defaultScheduleId != null) {
    return [
      {
        op: "INSERT_UPDATED",
        userId,
        defaultScheduleId: t.defaultScheduleId,
        kind: "CANCEL",
        updateDate: t.date,
        startAt: t.startAt,
        endAt: t.endAt,
      },
    ];
  }
  if (t.updatedScheduleId != null) {
    return t.updatedKind === "ADD"
      ? [{ op: "SOFT_DELETE_UPDATED", updatedScheduleId: t.updatedScheduleId }]
      : [{ op: "SET_UPDATED", updatedScheduleId: t.updatedScheduleId, kind: "CANCEL" }];
  }
  throw new Error("target shift has neither a default nor an updated reference");
}

function addOneOff(userId: number, date: string, startAt: Date, endAt: Date): OverrideOp {
  return {
    op: "INSERT_UPDATED",
    userId,
    defaultScheduleId: null,
    kind: "ADD",
    updateDate: date,
    startAt,
    endAt,
  };
}

function modifyOccurrence(
  userId: number,
  t: TargetShift,
  startAt: Date,
  endAt: Date,
): OverrideOp[] {
  if (t.defaultScheduleId != null) {
    return [
      {
        op: "INSERT_UPDATED",
        userId,
        defaultScheduleId: t.defaultScheduleId,
        kind: "MODIFY",
        updateDate: t.date,
        startAt,
        endAt,
      },
    ];
  }
  if (t.updatedScheduleId != null) {
    return [{ op: "SET_UPDATED", updatedScheduleId: t.updatedScheduleId, startAt, endAt }];
  }
  throw new Error("target shift has neither a default nor an updated reference");
}

export function planApproval(input: ApprovalPlanInput): OverrideOp[] {
  switch (input.type) {
    case "TIME_ADJUST":
      return modifyOccurrence(
        input.requesterId,
        input.target,
        input.adjustStartAt,
        input.adjustEndAt,
      );

    case "SHIFT":
      return [
        ...cancelOccurrence(input.requesterId, input.target),
        addOneOff(
          input.substituteUserId,
          input.target.date,
          input.target.startAt,
          input.target.endAt,
        ),
      ];

    case "SWAP":
      return [
        ...cancelOccurrence(input.requesterId, input.target),
        ...cancelOccurrence(input.peerUserId, input.peerTarget),
        // peer works the requester's shift; requester works the peer's shift
        addOneOff(
          input.peerUserId,
          input.target.date,
          input.target.startAt,
          input.target.endAt,
        ),
        addOneOff(
          input.requesterId,
          input.peerTarget.date,
          input.peerTarget.startAt,
          input.peerTarget.endAt,
        ),
      ];
  }
}
