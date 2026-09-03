"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { DOW_LABELS, addDays, addMonths, dayTitle, monthTitle, weekDays } from "@/lib/calendar";

import { AddShiftDialog } from "./forms/AddShiftDialog";
import { ShiftActionsDialog } from "./ShiftActionsDialog";
import { DayTimetable } from "./DayTimetable";
import { MonthGrid } from "./MonthGrid";
import styles from "./CalendarView.module.scss";

export interface CalShift {
  userId: number;
  date: string;
  startAt: string;
  endAt: string;
  source: "DEFAULT" | "UPDATED_MODIFY" | "UPDATED_ADD";
  defaultScheduleId: number | null;
  updatedScheduleId: number | null;
}

export interface StaffLite {
  id: number;
  name: string;
  color: string;
}

interface Props {
  view: "month" | "day";
  anchor: string;
  today: string;
  shifts: CalShift[];
  staff: StaffLite[];
  isManager: boolean;
  viewerId: number;
  selectedUserId: number | null;
}

export function CalendarView({
  view,
  anchor,
  today,
  shifts,
  staff,
  isManager,
  viewerId,
  selectedUserId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const strip = useMemo(() => weekDays(anchor), [anchor]);

  const [activeShift, setActiveShift] = useState<CalShift | null>(null);
  const [adding, setAdding] = useState(false);

  function go(next: Partial<{ view: string; date: string; userId: string | null }>) {
    const q = new URLSearchParams(params.toString());
    if (next.view !== undefined) q.set("view", next.view);
    if (next.date !== undefined) q.set("date", next.date);
    if (next.userId !== undefined) {
      if (next.userId === null) q.delete("userId");
      else q.set("userId", next.userId);
    }
    router.push(`${pathname}?${q.toString()}`);
  }

  const step = (dir: -1 | 1) =>
    go({ date: view === "day" ? addDays(anchor, dir) : addMonths(anchor, dir) });

  const title = view === "day" ? dayTitle(anchor) : monthTitle(anchor);
  const afterMutation = () => {
    setActiveShift(null);
    setAdding(false);
    router.refresh();
  };

  return (
    <section className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.navGroup}>
          <button type="button" onClick={() => step(-1)} aria-label="이전">
            <ChevronLeft size={18} />
          </button>
          <button type="button" className={styles.today} onClick={() => go({ date: today })}>
            오늘
          </button>
          <button type="button" onClick={() => step(1)} aria-label="다음">
            <ChevronRight size={18} />
          </button>
        </div>

        <h2 className={styles.title}>{title}</h2>

        <div className={styles.right}>
          {isManager && view === "day" && (
            <button
              type="button"
              className={styles.addShift}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} /> 근무 추가
            </button>
          )}

          <select
            className={styles.filter}
            value={selectedUserId ?? ""}
            onChange={(e) => go({ userId: e.target.value === "" ? null : e.target.value })}
          >
            <option value="">전체 근무자</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className={styles.viewToggle} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={view === "month"}
              className={view === "month" ? styles.active : ""}
              onClick={() => go({ view: "month" })}
            >
              월간
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "day"}
              className={view === "day" ? styles.active : ""}
              onClick={() => go({ view: "day" })}
            >
              일별
            </button>
          </div>
        </div>
      </div>

      {view === "day" ? (
        <>
          <div className={styles.strip}>
            {strip.map((d, i) => (
              <button
                key={d}
                type="button"
                className={styles.stripDay}
                data-selected={d === anchor || undefined}
                data-today={d === today || undefined}
                data-weekend={i === 0 ? "sun" : i === 6 ? "sat" : undefined}
                onClick={() => go({ date: d })}
              >
                <span className={styles.stripDow}>{DOW_LABELS[i]}</span>
                <span className={styles.stripNum}>{Number(d.slice(8, 10))}</span>
              </button>
            ))}
          </div>
          <DayTimetable
            date={anchor}
            shifts={shifts}
            staff={staff}
            selectedUserId={selectedUserId}
            onShiftClick={setActiveShift}
          />
        </>
      ) : (
        <>
          {staff.length > 0 && (
            <div className={styles.legend}>
              {staff.map((s) => (
                <span key={s.id} className={styles.legendItem}>
                  <i style={{ background: s.color }} />
                  {s.name}
                </span>
              ))}
            </div>
          )}
          <MonthGrid
            anchor={anchor}
            today={today}
            shifts={shifts}
            staffById={staffById}
            onShiftClick={setActiveShift}
            onDateClick={(date) => go({ view: "day", date })}
          />
        </>
      )}

      {activeShift && (
        <ShiftActionsDialog
          shift={activeShift}
          viewerId={viewerId}
          isManager={isManager}
          staffName={staffById.get(activeShift.userId)?.name ?? `#${activeShift.userId}`}
          roster={staff}
          onClose={() => setActiveShift(null)}
          onDone={afterMutation}
        />
      )}

      {adding && isManager && (
        <AddShiftDialog
          date={anchor}
          roster={staff}
          onClose={() => setAdding(false)}
          onDone={afterMutation}
        />
      )}
    </section>
  );
}
