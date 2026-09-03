import { db } from "@/core/db";
import type { DefaultScheduleRow } from "@/core/db/schema";
import { Errors } from "@/core/http/envelope";
import {
  anchorRecurringTime,
  kstHhmm,
  monthKey,
  occurrenceFromPattern,
} from "@/core/time/kst";

import type {
  ConflictCandidate,
  IgnoreRef,
  ResolvedShift,
  TargetShift,
} from "../domain/scheduleResolver";
import { findConflicts } from "../domain/scheduleResolver";
import type {
  CreateDefaultScheduleInput,
  ManagerEditInput,
  UpdateDefaultScheduleInput,
} from "../domain/types";
import { invalidateFrom, invalidateMonths } from "../infrastructure/monthCache";
import * as repo from "../infrastructure/scheduleRepository";

type Exec = repo.Exec;

/* --------------------------------------------------- default schedules -- */

export function listDefaultSchedules(userId: number): Promise<DefaultScheduleRow[]> {
  return repo.listDefaultSchedules(userId);
}

export async function createDefaultSchedule(
  userId: number,
  input: CreateDefaultScheduleInput,
): Promise<DefaultScheduleRow> {
  const { startTime, endTime } = anchorRecurringTime(input.startHhmm, input.endHhmm);
  const row = await repo.insertDefault({
    userId,
    dayOfWeek: input.dayOfWeek,
    startTime,
    endTime,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
  });
  await invalidateFrom(input.startDate);
  return row;
}

export async function updateDefaultSchedule(
  id: number,
  patch: UpdateDefaultScheduleInput,
): Promise<DefaultScheduleRow> {
  const current = await repo.findDefaultById(id);
  if (!current) throw Errors.notFound("기본 근무");

  const times =
    patch.startHhmm || patch.endHhmm
      ? anchorRecurringTime(
          patch.startHhmm ?? kstHhmm(current.startTime),
          patch.endHhmm ?? kstHhmm(current.endTime),
        )
      : null;

  const row = await repo.updateDefault(id, {
    dayOfWeek: patch.dayOfWeek ?? current.dayOfWeek,
    startTime: times?.startTime ?? current.startTime,
    endTime: times?.endTime ?? current.endTime,
    startDate: patch.startDate ?? current.startDate,
    endDate: patch.endDate === undefined ? current.endDate : patch.endDate,
  });
  await invalidateFrom(patch.startDate ?? current.startDate);
  return row!;
}

/** "Delete" = stop the recurrence from a date onward (PLAN sec.9 case 4). */
export async function endDefaultSchedule(
  id: number,
  endDate: string,
): Promise<DefaultScheduleRow> {
  const row = await repo.updateDefault(id, { endDate });
  if (!row) throw Errors.notFound("기본 근무");
  await invalidateFrom(endDate);
  return row;
}

/* ---------------------------------------------------------- targeting -- */

/** Resolve a deterministic target pointer to a real, unchanged shift. */
export async function resolveTargetShift(
  exec: Exec,
  args: {
    date: string;
    targetDefaultScheduleId?: number | null;
    targetUpdatedScheduleId?: number | null;
  },
): Promise<TargetShift> {
  if (args.targetUpdatedScheduleId != null) {
    const row = await repo.findUpdatedById(args.targetUpdatedScheduleId, exec);
    if (!row || row.deletedAt) throw Errors.notFound("대상 근무");
    if (row.kind === "CANCEL") throw Errors.conflict("이미 취소된 근무입니다.");
    return {
      date: row.updateDate,
      startAt: row.startAt,
      endAt: row.endAt,
      defaultScheduleId: null,
      updatedScheduleId: row.id,
      updatedKind: row.kind,
    };
  }

  if (args.targetDefaultScheduleId != null) {
    const pattern = await repo.findDefaultById(args.targetDefaultScheduleId, exec);
    if (!pattern) throw Errors.notFound("대상 근무");
    const existing = await repo.findLiveOccurrenceException(
      args.targetDefaultScheduleId,
      args.date,
      exec,
    );
    if (existing) throw Errors.conflict("이미 변경된 근무입니다. 요청을 다시 생성하세요.");

    const { startAt, endAt } = occurrenceFromPattern(
      args.date,
      pattern.startTime,
      pattern.endTime,
    );
    return {
      date: args.date,
      startAt,
      endAt,
      defaultScheduleId: pattern.id,
      updatedScheduleId: null,
    };
  }

  throw Errors.badRequest("대상 근무 참조가 없습니다.");
}

/** Resolve one user's shifts on a date and return overlaps with `candidate`. */
export async function checkUserConflicts(
  userId: number,
  date: string,
  candidate: ConflictCandidate,
  ignore: IgnoreRef = {},
): Promise<ResolvedShift[]> {
  const existing = await repo.getResolvedShifts({
    from: date,
    to: date,
    userId,
    includeInactive: true,
  });
  return findConflicts(existing, candidate, ignore);
}

/* --------------------------------------------------- manager direct edit -- */

export async function managerEditSchedule(
  input: ManagerEditInput,
): Promise<{ affectedMonths: string[] }> {
  const affectedMonths = [monthKey(input.updateDate)];

  await db.transaction(async (tx) => {
    if (input.kind === "ADD") {
      if (input.endAt <= input.startAt) {
        throw Errors.badRequest("종료 시간이 시작 시간보다 빠릅니다.");
      }
      const conflicts = await checkUserConflicts(input.userId, input.updateDate, {
        startAt: input.startAt,
        endAt: input.endAt,
      });
      if (conflicts.length) {
        throw Errors.conflict("해당 시간에 이미 배정된 근무가 있습니다.", conflicts);
      }
      await repo.insertUpdated(
        {
          userId: input.userId,
          defaultScheduleId: null,
          kind: "ADD",
          updateDate: input.updateDate,
          startAt: input.startAt,
          endAt: input.endAt,
        },
        tx,
      );
      return;
    }

    const pattern = await repo.findDefaultById(input.defaultScheduleId, tx);
    if (!pattern) throw Errors.notFound("기본 근무");

    const occ = occurrenceFromPattern(input.updateDate, pattern.startTime, pattern.endTime);
    const startAt = input.kind === "MODIFY" ? input.startAt : occ.startAt;
    const endAt = input.kind === "MODIFY" ? input.endAt : occ.endAt;
    if (input.kind === "MODIFY" && endAt <= startAt) {
      throw Errors.badRequest("종료 시간이 시작 시간보다 빠릅니다.");
    }

    const existing = await repo.findLiveOccurrenceException(pattern.id, input.updateDate, tx);
    if (existing) {
      await repo.updateUpdatedFields(
        existing.id,
        { kind: input.kind, startAt, endAt, version: existing.version + 1 },
        tx,
      );
    } else {
      await repo.insertUpdated(
        {
          userId: pattern.userId,
          defaultScheduleId: pattern.id,
          kind: input.kind,
          updateDate: input.updateDate,
          startAt,
          endAt,
        },
        tx,
      );
    }
  });

  await invalidateMonths(affectedMonths);
  return { affectedMonths };
}
