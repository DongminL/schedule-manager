"use client";

import { use } from "react";

import type { CalShift, StaffLite } from "./CalendarView";
import { DayTimetable } from "./DayTimetable";
import { MonthGrid } from "./MonthGrid";

interface Props {
  view: "month" | "day";
  shiftsPromise: Promise<CalShift[]>;
  anchor: string;
  today: string;
  staffById: Map<number, StaffLite>;
  allStaff: StaffLite[];
  selectedUserId: number | null;
  onShiftClick: (s: CalShift) => void;
  onDateClick: (date: string) => void;
}

/** Unwraps the streamed shift list so the calendar grid can render before it arrives. */
export function ShiftsLayer({
  view,
  shiftsPromise,
  anchor,
  today,
  staffById,
  allStaff,
  selectedUserId,
  onShiftClick,
  onDateClick,
}: Props) {
  const shifts = use(shiftsPromise);

  return view === "day" ? (
    <DayTimetable
      date={anchor}
      shifts={shifts}
      staff={allStaff}
      selectedUserId={selectedUserId}
      onShiftClick={onShiftClick}
    />
  ) : (
    <MonthGrid
      anchor={anchor}
      today={today}
      shifts={shifts}
      staffById={staffById}
      onShiftClick={onShiftClick}
      onDateClick={onDateClick}
    />
  );
}
