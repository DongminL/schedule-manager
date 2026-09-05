import { DOW_LABELS, isSameMonth, kstClock, monthGridDays } from "@/lib/calendar";

import type { CalShift, StaffLite } from "./CalendarView";
import styles from "./MonthGrid.module.scss";

const MAX_CHIPS = 3;

interface Props {
  anchor: string;
  today: string;
  shifts: CalShift[];
  staffById: Map<number, StaffLite>;
  onShiftClick?: (s: CalShift) => void;
  onDateClick?: (date: string) => void;
  isSelected?: (s: CalShift) => boolean;
}

export function MonthGrid({
  anchor,
  today,
  shifts,
  staffById,
  onShiftClick,
  onDateClick,
  isSelected,
}: Props) {
  const days = monthGridDays(anchor);

  const byDate = new Map<string, CalShift[]>();
  for (const s of shifts) {
    const list = byDate.get(s.date) ?? [];
    list.push(s);
    byDate.set(s.date, list);
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => a.startAt.localeCompare(b.startAt));
  }

  return (
    <div className={styles.grid} role="grid" aria-label="월간 캘린더">
      {DOW_LABELS.map((label, i) => (
        <div
          key={label}
          className={styles.dow}
          data-weekend={i === 0 ? "sun" : i === 6 ? "sat" : undefined}
        >
          {label}
        </div>
      ))}

      {days.map((date) => {
        const list = byDate.get(date) ?? [];
        const shown = list.slice(0, MAX_CHIPS);
        const overflow = list.length - shown.length;
        const dim = !isSameMonth(date, anchor);
        const dow = new Date(`${date}T00:00:00Z`).getUTCDay();

        return (
          <div
            key={date}
            role={onDateClick ? "button" : undefined}
            tabIndex={onDateClick ? 0 : undefined}
            aria-label={onDateClick ? `${date} 일별 보기` : undefined}
            className={styles.cell}
            data-dim={dim || undefined}
            data-today={date === today || undefined}
            data-clickable={onDateClick ? "" : undefined}
            onClick={() => onDateClick?.(date)}
            onKeyDown={(e) => {
              if (onDateClick && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onDateClick(date);
              }
            }}
          >
            <div
              className={styles.dayNum}
              data-weekend={dow === 0 ? "sun" : dow === 6 ? "sat" : undefined}
            >
              {Number(date.slice(8, 10))}
            </div>

            <div className={styles.chips}>
              {shown.map((s, idx) => {
                const staff = staffById.get(s.userId);
                return (
                  <button
                    type="button"
                    key={`${s.userId}-${s.date}-${idx}`}
                    className={styles.chip}
                    style={{ background: staff?.color ?? "#9ca3af" }}
                    data-selected={isSelected?.(s) || undefined}
                    title={`${kstClock(s.startAt).label}–${kstClock(s.endAt).label} ${staff?.name ?? ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onShiftClick?.(s);
                    }}
                  >
                    <b>{kstClock(s.startAt).label}</b>
                    <span>{staff?.name ?? `#${s.userId}`}</span>
                  </button>
                );
              })}
              {overflow > 0 && <div className={styles.more}>+{overflow}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
