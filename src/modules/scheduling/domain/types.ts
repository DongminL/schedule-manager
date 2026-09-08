import type { DayOfWeek } from "@/core/db/schema";

export interface CreateDefaultScheduleInput {
  dayOfWeek: DayOfWeek;
  startHhmm: string;
  endHhmm: string;
  startDate: string;
  endDate?: string | null;
}

export interface UpdateDefaultScheduleInput {
  dayOfWeek?: DayOfWeek;
  startHhmm?: string;
  endHhmm?: string;
  startDate?: string;
  endDate?: string | null;
}

/** 
 * "This and following" edit: close the pattern the day before `fromDate` and
 *  open a new one from `fromDate` carrying the patch, so occurrences before
 *  `fromDate` are untouched.
 */
export interface SplitDefaultScheduleInput {
  fromDate: string;
  dayOfWeek?: DayOfWeek;
  startHhmm?: string;
  endHhmm?: string;
}

export interface ManagerEditAdd {
  kind: "ADD";
  userId: number;
  updateDate: string;
  startAt: Date;
  endAt: Date;
}
export interface ManagerEditModify {
  kind: "MODIFY";
  defaultScheduleId: number;
  updateDate: string;
  startAt: Date;
  endAt: Date;
}
export interface ManagerEditCancel {
  kind: "CANCEL";
  defaultScheduleId: number;
  updateDate: string;
}
export type ManagerEditInput = ManagerEditAdd | ManagerEditModify | ManagerEditCancel;
