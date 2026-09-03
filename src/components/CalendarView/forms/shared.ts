import type { CalShift } from "../CalendarView";

/** The API wants exactly one of targetDefaultScheduleId / targetUpdatedScheduleId
 *  for a change request. Derive it from the resolved shift's origin. */
export function targetRef(shift: CalShift): Record<string, number> {
  return shift.source === "DEFAULT"
    ? { targetDefaultScheduleId: shift.defaultScheduleId ?? 0 }
    : { targetUpdatedScheduleId: shift.updatedScheduleId ?? 0 };
}

export function peerTargetRef(shift: CalShift): Record<string, number> {
  return shift.source === "DEFAULT"
    ? { peerTargetDefaultScheduleId: shift.defaultScheduleId ?? 0 }
    : { peerTargetUpdatedScheduleId: shift.updatedScheduleId ?? 0 };
}
