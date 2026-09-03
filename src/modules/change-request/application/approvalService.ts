import { db, type Tx } from "@/core/db";
import type { ScheduleChangeRequestRow } from "@/core/db/schema";
import { Errors } from "@/core/http/envelope";
import { monthKey } from "@/core/time/kst";
import {
  checkUserConflicts,
  resolveTargetShift,
} from "@/modules/scheduling/application/schedulingService";
import { invalidateMonths } from "@/modules/scheduling/infrastructure/monthCache";
import * as schedRepo from "@/modules/scheduling/infrastructure/scheduleRepository";

import { planApproval, type OverrideOp } from "../domain/planApproval";
import * as repo from "../infrastructure/changeRequestRepository";

async function applyOverrideOps(tx: Tx, ops: OverrideOp[]): Promise<void> {
  for (const op of ops) {
    if (op.op === "INSERT_UPDATED") {
      await schedRepo.insertUpdated(
        {
          userId: op.userId,
          defaultScheduleId: op.defaultScheduleId,
          kind: op.kind,
          updateDate: op.updateDate,
          startAt: op.startAt,
          endAt: op.endAt,
        },
        tx,
      );
    } else if (op.op === "SOFT_DELETE_UPDATED") {
      await schedRepo.softDeleteUpdated(op.updatedScheduleId, tx);
    } else {
      await schedRepo.updateUpdatedFields(
        op.updatedScheduleId,
        { kind: op.kind, startAt: op.startAt, endAt: op.endAt },
        tx,
      );
    }
  }
}

export async function rejectChangeRequest(
  managerId: number,
  id: number,
  rejectReason: string,
  expectedVersion?: number,
): Promise<ScheduleChangeRequestRow> {
  const current = await repo.findParentById(id);
  if (!current) throw Errors.notFound("변경 요청");
  const updated = await repo.markRejected(
    id,
    managerId,
    rejectReason,
    current.version + 1,
    expectedVersion,
  );
  if (!updated) throw Errors.conflict("이미 처리되었거나 버전이 일치하지 않습니다.");
  return updated;
}

export async function approveChangeRequest(
  managerId: number,
  id: number,
  expectedVersion?: number,
): Promise<{ request: ScheduleChangeRequestRow; affectedMonths: string[] }> {
  const result = await db.transaction(async (tx: Tx) => {
    const parent = await repo.findParentById(id, tx);
    if (!parent || parent.deletedAt) throw Errors.notFound("변경 요청");
    if (parent.status !== "PENDING") throw Errors.conflict("승인 가능한 상태(PENDING)가 아닙니다.");
    if (expectedVersion !== undefined && parent.version !== expectedVersion) {
      throw Errors.versionConflict();
    }

    const target = await resolveTargetShift(tx, {
      date: parent.updateDate,
      targetDefaultScheduleId: parent.targetDefaultScheduleId,
      targetUpdatedScheduleId: parent.targetUpdatedScheduleId,
    });

    const affectedMonths = new Set<string>([monthKey(parent.updateDate)]);
    let ops: OverrideOp[];

    if (parent.type === "TIME_ADJUST") {
      const adjust = await repo.findTimeAdjustmentByParent(id, tx);
      if (!adjust) throw Errors.notFound("시간 조정 상세");

      const conflicts = await checkUserConflicts(
        parent.userId,
        target.date,
        { startAt: adjust.adjustStartAt, endAt: adjust.adjustEndAt },
        {
          defaultScheduleId: target.defaultScheduleId,
          updatedScheduleId: target.updatedScheduleId,
        },
      );
      if (conflicts.length) {
        throw Errors.conflict("해당 시간에 이미 배정된 근무가 있습니다.", conflicts);
      }

      ops = planApproval({
        type: "TIME_ADJUST",
        requesterId: parent.userId,
        target,
        adjustStartAt: adjust.adjustStartAt,
        adjustEndAt: adjust.adjustEndAt,
      });
    } else if (parent.type === "SHIFT") {
      const sub = await repo.findSubstituteByParent(id, tx);
      if (!sub) throw Errors.notFound("대타 상세");
      if (!parent.peerAcceptedAt) throw Errors.conflict("대타 근무자의 수락이 필요합니다.");

      const conflicts = await checkUserConflicts(sub.userId, target.date, {
        startAt: target.startAt,
        endAt: target.endAt,
      });
      if (conflicts.length) {
        throw Errors.conflict("대타 근무자가 해당 시간에 이미 근무가 있습니다.", conflicts);
      }

      ops = planApproval({
        type: "SHIFT",
        requesterId: parent.userId,
        target,
        substituteUserId: sub.userId,
      });
    } else {
      const swap = await repo.findSwapByParent(id, tx);
      if (!swap) throw Errors.notFound("교환 상세");
      if (!parent.peerAcceptedAt) throw Errors.conflict("교환 상대의 수락이 필요합니다.");

      const peerTarget = await resolveTargetShift(tx, {
        date: swap.swapDate,
        targetDefaultScheduleId: swap.peerTargetDefaultScheduleId,
        targetUpdatedScheduleId: swap.peerTargetUpdatedScheduleId,
      });
      affectedMonths.add(monthKey(swap.swapDate));

      const [requesterConflicts, peerConflicts] = await Promise.all([
        checkUserConflicts(
          parent.userId,
          peerTarget.date,
          { startAt: peerTarget.startAt, endAt: peerTarget.endAt },
          {
            defaultScheduleId: target.defaultScheduleId,
            updatedScheduleId: target.updatedScheduleId,
          },
        ),
        checkUserConflicts(
          swap.peerUserId,
          target.date,
          { startAt: target.startAt, endAt: target.endAt },
          {
            defaultScheduleId: peerTarget.defaultScheduleId,
            updatedScheduleId: peerTarget.updatedScheduleId,
          },
        ),
      ]);
      if (requesterConflicts.length || peerConflicts.length) {
        throw Errors.conflict("교환 시 이중 배정이 발생합니다.", {
          requesterConflicts,
          peerConflicts,
        });
      }

      ops = planApproval({
        type: "SWAP",
        requesterId: parent.userId,
        target,
        peerUserId: swap.peerUserId,
        peerTarget,
      });
    }

    await applyOverrideOps(tx, ops);

    const updated = await repo.markApproved(id, managerId, parent.version, tx);
    if (!updated) throw Errors.versionConflict();

    return { request: updated, affectedMonths: [...affectedMonths] };
  });

  await invalidateMonths(result.affectedMonths);
  return result;
}
