import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { db, type Exec } from "@/core/db";
import {
  scheduleChangeRequests,
  substituteRequests,
  swapRequests,
  timeAdjustmentRequests,
  type NewScheduleChangeRequestRow,
  type RequestStatus,
  type ScheduleChangeRequestRow,
  type SubstituteRequestRow,
  type SwapRequestRow,
  type TimeAdjustmentRequestRow,
} from "@/core/db/schema";

export type { Exec };

/* ------------------------------------------------------------- inserts -- */

export function insertParent(
  values: NewScheduleChangeRequestRow,
  exec: Exec,
): Promise<ScheduleChangeRequestRow> {
  return exec
    .insert(scheduleChangeRequests)
    .values(values)
    .returning()
    .then((r) => r[0]!);
}

export function insertTimeAdjustment(
  values: { scheduleChangeRequestId: number; adjustStartAt: Date; adjustEndAt: Date },
  exec: Exec,
): Promise<unknown> {
  return exec.insert(timeAdjustmentRequests).values(values);
}

export function insertSubstitute(
  values: { scheduleChangeRequestId: number; userId: number },
  exec: Exec,
): Promise<unknown> {
  return exec.insert(substituteRequests).values(values);
}

export function insertSwap(
  values: {
    scheduleChangeRequestId: number;
    peerUserId: number;
    swapDate: string;
    startAt: Date;
    endAt: Date;
    peerTargetDefaultScheduleId: number | null;
    peerTargetUpdatedScheduleId: number | null;
  },
  exec: Exec,
): Promise<unknown> {
  return exec.insert(swapRequests).values(values);
}

/* --------------------------------------------------------------- finds -- */

export function findParentById(
  id: number,
  exec: Exec = db,
): Promise<ScheduleChangeRequestRow | undefined> {
  return exec
    .select()
    .from(scheduleChangeRequests)
    .where(eq(scheduleChangeRequests.id, id))
    .limit(1)
    .then((r) => r[0]);
}

export function findSwapByParent(
  parentId: number,
  exec: Exec = db,
): Promise<SwapRequestRow | undefined> {
  return exec
    .select()
    .from(swapRequests)
    .where(eq(swapRequests.scheduleChangeRequestId, parentId))
    .limit(1)
    .then((r) => r[0]);
}

export function findSubstituteByParent(
  parentId: number,
  exec: Exec = db,
): Promise<SubstituteRequestRow | undefined> {
  return exec
    .select()
    .from(substituteRequests)
    .where(eq(substituteRequests.scheduleChangeRequestId, parentId))
    .limit(1)
    .then((r) => r[0]);
}

export function findTimeAdjustmentByParent(
  parentId: number,
  exec: Exec = db,
): Promise<TimeAdjustmentRequestRow | undefined> {
  return exec
    .select()
    .from(timeAdjustmentRequests)
    .where(eq(timeAdjustmentRequests.scheduleChangeRequestId, parentId))
    .limit(1)
    .then((r) => r[0]);
}

/* --------------------------------------------------------------- lists -- */

export function listAll(status?: RequestStatus): Promise<ScheduleChangeRequestRow[]> {
  return db
    .select()
    .from(scheduleChangeRequests)
    .where(
      and(
        isNull(scheduleChangeRequests.deletedAt),
        status ? eq(scheduleChangeRequests.status, status) : undefined,
      ),
    )
    .orderBy(desc(scheduleChangeRequests.createdAt));
}

export async function listPeerParentIds(userId: number): Promise<number[]> {
  const [swapRows, substituteRows] = await Promise.all([
    db
      .select({ id: swapRequests.scheduleChangeRequestId })
      .from(swapRequests)
      .where(eq(swapRequests.peerUserId, userId)),
    db
      .select({ id: substituteRequests.scheduleChangeRequestId })
      .from(substituteRequests)
      .where(eq(substituteRequests.userId, userId)),
  ]);
  return [...swapRows.map((r) => r.id), ...substituteRows.map((r) => r.id)];
}

export function listForStaff(
  userId: number,
  peerParentIds: number[],
  status?: RequestStatus,
): Promise<ScheduleChangeRequestRow[]> {
  return db
    .select()
    .from(scheduleChangeRequests)
    .where(
      and(
        isNull(scheduleChangeRequests.deletedAt),
        status ? eq(scheduleChangeRequests.status, status) : undefined,
        or(
          eq(scheduleChangeRequests.userId, userId),
          peerParentIds.length
            ? inArray(scheduleChangeRequests.id, peerParentIds)
            : undefined,
        ),
      ),
    )
    .orderBy(desc(scheduleChangeRequests.createdAt));
}

/* ------------------------------------------------------ status changes -- */

/** Move a WAITING_PEER_ACCEPT request to PENDING. Returns undefined on stale state. */
export function markPeerAccepted(
  id: number,
  exec: Exec = db,
): Promise<ScheduleChangeRequestRow | undefined> {
  return exec
    .update(scheduleChangeRequests)
    .set({ status: "PENDING", peerAcceptedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(scheduleChangeRequests.id, id),
        eq(scheduleChangeRequests.status, "WAITING_PEER_ACCEPT"),
      ),
    )
    .returning()
    .then((r) => r[0]);
}

export function markPeerRejected(
  id: number,
  reason: string,
  exec: Exec = db,
): Promise<ScheduleChangeRequestRow | undefined> {
  return exec
    .update(scheduleChangeRequests)
    .set({ status: "REJECT", rejectReason: reason, updatedAt: new Date() })
    .where(
      and(
        eq(scheduleChangeRequests.id, id),
        eq(scheduleChangeRequests.status, "WAITING_PEER_ACCEPT"),
      ),
    )
    .returning()
    .then((r) => r[0]);
}

export function markRejected(
  id: number,
  managerId: number,
  rejectReason: string,
  nextVersion: number,
  expectedVersion: number | undefined,
): Promise<ScheduleChangeRequestRow | undefined> {
  return db
    .update(scheduleChangeRequests)
    .set({
      status: "REJECT",
      rejectReason,
      approveBy: managerId,
      updatedAt: new Date(),
      version: nextVersion,
    })
    .where(
      and(
        eq(scheduleChangeRequests.id, id),
        inArray(scheduleChangeRequests.status, ["PENDING", "WAITING_PEER_ACCEPT"]),
        expectedVersion === undefined
          ? undefined
          : eq(scheduleChangeRequests.version, expectedVersion),
      ),
    )
    .returning()
    .then((r) => r[0]);
}

export function markApproved(
  id: number,
  managerId: number,
  fromVersion: number,
  exec: Exec,
): Promise<ScheduleChangeRequestRow | undefined> {
  return exec
    .update(scheduleChangeRequests)
    .set({
      status: "APPROVAL",
      approveBy: managerId,
      updatedAt: new Date(),
      version: fromVersion + 1,
    })
    .where(
      and(eq(scheduleChangeRequests.id, id), eq(scheduleChangeRequests.version, fromVersion)),
    )
    .returning()
    .then((r) => r[0]);
}
