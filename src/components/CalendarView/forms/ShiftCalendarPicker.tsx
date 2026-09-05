"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { apiGet } from "@/lib/api";
import { addMonths, dayTitle, kstToday, monthGridDays, monthTitle } from "@/lib/calendar";

import type { CalShift, StaffLite } from "../CalendarView";
import { DayTimetable } from "../DayTimetable";
import { MonthGrid } from "../MonthGrid";
import { keyOf } from "./shared";
import styles from "./ShiftCalendarPicker.module.scss";

interface Props {
  /** "own": only the viewer's shifts. "all": every other staff's shifts. */
  mode: "own" | "all";
  viewerId: number;
  roster: StaffLite[];
  selectedKey: string;
  onSelect: (shift: CalShift) => void;
  /** Month to open on, defaults to today. */
  initialAnchor?: string;
}

/** Month-calendar shift picker, mirroring the main CalendarView's MonthGrid +
 *  DayTimetable: a chip click selects a shift directly, a date (or its "+N")
 *  click opens that day's full timetable in a popup. No fixed date range —
 *  the visible month drives the fetch. */
export function ShiftCalendarPicker({
  mode,
  viewerId,
  roster,
  selectedKey,
  onSelect,
  initialAnchor,
}: Props) {
  const today = kstToday();
  const [anchor, setAnchor] = useState(initialAnchor ?? today);
  const [shifts, setShifts] = useState<CalShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDate, setOpenDate] = useState<string | null>(null);

  const grid = useMemo(() => monthGridDays(anchor), [anchor]);
  const from = grid[0]!;
  const to = grid[grid.length - 1]!;

  useEffect(() => {
    const ctrl = new AbortController();
    // Data-fetching effect: reset to a loading state, then load the visible
    // month's shifts. Aborted on cleanup.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    apiGet<{ shifts: CalShift[] }>(`/api/schedules?from=${from}&to=${to}`)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setShifts(
          mode === "own"
            ? res.shifts.filter((s) => s.userId === viewerId)
            : res.shifts.filter((s) => s.userId !== viewerId),
        );
      })
      .catch(() => {})
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [mode, viewerId, from, to]);

  const staffById = useMemo(() => new Map(roster.map((s) => [s.id, s])), [roster]);

  return (
    <div className={styles.wrap}>
      <div className={styles.nav}>
        <button type="button" onClick={() => setAnchor(addMonths(anchor, -1))} aria-label="이전 달">
          <ChevronLeft size={16} />
        </button>
        <button type="button" className={styles.today} onClick={() => setAnchor(today)}>
          오늘
        </button>
        <button type="button" onClick={() => setAnchor(addMonths(anchor, 1))} aria-label="다음 달">
          <ChevronRight size={16} />
        </button>
        <span className={styles.title}>{monthTitle(anchor)}</span>
      </div>

      {loading ? (
        <p className={styles.note}>불러오는 중…</p>
      ) : (
        <MonthGrid
          anchor={anchor}
          today={today}
          shifts={shifts}
          staffById={staffById}
          isSelected={(s) => keyOf(s) === selectedKey}
          onShiftClick={onSelect}
          onDateClick={setOpenDate}
        />
      )}

      {openDate && (
        <Modal open onClose={() => setOpenDate(null)} title={dayTitle(openDate)}>
          <DayTimetable
            date={openDate}
            shifts={shifts}
            staff={roster}
            selectedUserId={null}
            onShiftClick={(s) => {
              onSelect(s);
              setOpenDate(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
