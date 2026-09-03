import { db, type Tx } from "@/core/db";
import type { RequestStatus, ScheduleChangeRequestRow } from "@/core/db/schema";
import { Errors } from "@/core/http/envelope";
import { findById as findUserById } from "@/modules/account/infrastructure/userRepository";
import type { SessionUser } from "@/modules/auth/presentation/guards";
import { resolveTargetShift } from "@/modules/scheduling/application/schedulingService";

import type { CreateChangeRequestInput, CreateSwapInput } from "../domain/types";
import * as repo from "../infrastructure/changeRequestRepository";

async function assertActive(userId: number, label: string): Promise<void> {
  const u = await findUserById(userId);
  if (!u) throw Errors.notFound(label);
  if (!u.isActive) throw Errors.badRequest(`${label}가 비활성 상태입니다.`);
}

export async function createChangeRequest(
  requesterId: number,
  input: CreateChangeRequestInput,
): Promise<ScheduleChangeRequestRow> {
  if (input.endAt <= input.startAt) throw Errors.badRequest("종료 시간이 시작 시간보다 빠릅니다.");

  return db.transaction(async (tx: Tx) => {
    await resolveTargetShift(tx, {
      date: input.updateDate,
      targetDefaultScheduleId: input.targetDefaultScheduleId,
      targetUpdatedScheduleId: input.targetUpdatedScheduleId,
    });

    const parent = await repo.insertParent(
      {
        userId: requesterId,
        type: input.type,
        updateDate: input.updateDate,
        startAt: input.startAt,
        endAt: input.endAt,
        targetDefaultScheduleId: input.targetDefaultScheduleId ?? null,
        targetUpdatedScheduleId: input.targetUpdatedScheduleId ?? null,
        reason: input.reason,
        status: input.type === "TIME_ADJUST" ? "PENDING" : "WAITING_PEER_ACCEPT",
      },
      tx,
    );

    if (input.type === "TIME_ADJUST") {
      if (input.adjustEndAt <= input.adjustStartAt) {
        throw Errors.badRequest("조정 종료 시간이 시작 시간보다 빠릅니다.");
      }
      await repo.insertTimeAdjustment(
        {
          scheduleChangeRequestId: parent.id,
          adjustStartAt: input.adjustStartAt,
          adjustEndAt: input.adjustEndAt,
        },
        tx,
      );
    } else if (input.type === "SHIFT") {
      if (input.substituteUserId === requesterId) {
        throw Errors.badRequest("본인을 대타로 지정할 수 없습니다.");
      }
      await assertActive(input.substituteUserId, "대타 근무자");
      await repo.insertSubstitute(
        { scheduleChangeRequestId: parent.id, userId: input.substituteUserId },
        tx,
      );
    } else {
      const swap = input as CreateSwapInput;
      if (swap.peerUserId === requesterId) throw Errors.badRequest("본인과 교환할 수 없습니다.");
      await assertActive(swap.peerUserId, "교환 상대");
      await resolveTargetShift(tx, {
        date: swap.peerUpdateDate,
        targetDefaultScheduleId: swap.peerTargetDefaultScheduleId,
        targetUpdatedScheduleId: swap.peerTargetUpdatedScheduleId,
      });
      await repo.insertSwap(
        {
          scheduleChangeRequestId: parent.id,
          peerUserId: swap.peerUserId,
          swapDate: swap.peerUpdateDate,
          startAt: swap.peerStartAt,
          endAt: swap.peerEndAt,
          peerTargetDefaultScheduleId: swap.peerTargetDefaultScheduleId ?? null,
          peerTargetUpdatedScheduleId: swap.peerTargetUpdatedScheduleId ?? null,
        },
        tx,
      );
    }

    return parent;
  });
}

export async function listChangeRequests(
  viewer: SessionUser,
  status?: RequestStatus,
): Promise<ScheduleChangeRequestRow[]> {
  if (viewer.role === "MANAGER") return repo.listAll(status);
  const peerParentIds = await repo.listPeerParentIds(viewer.id);
  return repo.listForStaff(viewer.id, peerParentIds, status);
}

export async function getChangeRequestDetail(id: number, viewer: SessionUser) {
  const parent = await repo.findParentById(id);
  if (!parent || parent.deletedAt) throw Errors.notFound("변경 요청");

  // Only the detail table matching `parent.type` can hold a row.
  const swap = parent.type === "SWAP" ? await repo.findSwapByParent(id) : undefined;
  const substitute =
    parent.type === "SHIFT" ? await repo.findSubstituteByParent(id) : undefined;
  const timeAdjust =
    parent.type === "TIME_ADJUST" ? await repo.findTimeAdjustmentByParent(id) : undefined;

  const isOwner = parent.userId === viewer.id;
  const isPeer = swap?.peerUserId === viewer.id || substitute?.userId === viewer.id;
  if (viewer.role !== "MANAGER" && !isOwner && !isPeer) throw Errors.forbidden();

  return {
    ...parent,
    substitute: substitute ?? null,
    swap: swap ?? null,
    timeAdjust: timeAdjust ?? null,
  };
}

/** The user whose acceptance a WAITING_PEER_ACCEPT request needs: the swap
 *  peer for SWAP, the assigned substitute for SHIFT. */
async function findPeerUserId(id: number, tx: Tx): Promise<number | undefined> {
  const parent = await repo.findParentById(id, tx);
  if (!parent) return undefined;
  if (parent.type === "SWAP") return (await repo.findSwapByParent(id, tx))?.peerUserId;
  if (parent.type === "SHIFT") return (await repo.findSubstituteByParent(id, tx))?.userId;
  return undefined;
}

export async function peerAccept(id: number, peerId: number): Promise<ScheduleChangeRequestRow> {
  return db.transaction(async (tx: Tx) => {
    const peerUserId = await findPeerUserId(id, tx);
    if (peerUserId === undefined) throw Errors.notFound("변경 요청");
    if (peerUserId !== peerId) throw Errors.forbidden();
    const updated = await repo.markPeerAccepted(id, tx);
    if (!updated) throw Errors.conflict("이미 처리되었거나 수락 대기 상태가 아닙니다.");
    return updated;
  });
}

export async function peerReject(
  id: number,
  peerId: number,
  reason: string,
): Promise<ScheduleChangeRequestRow> {
  return db.transaction(async (tx: Tx) => {
    const peerUserId = await findPeerUserId(id, tx);
    if (peerUserId === undefined) throw Errors.notFound("변경 요청");
    if (peerUserId !== peerId) throw Errors.forbidden();
    const updated = await repo.markPeerRejected(id, reason, tx);
    if (!updated) throw Errors.conflict("이미 처리되었거나 수락 대기 상태가 아닙니다.");
    return updated;
  });
}
