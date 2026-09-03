import type { CSSProperties } from "react";

import { durationMinutes, kstClock } from "@/lib/calendar";

import type { CalShift, StaffLite } from "./CalendarView";
import styles from "./DayTimetable.module.scss";

const HOUR_W = 96; // px per hour on the time axis
const LANE_H = 42; // px per stacked sub-lane inside a staff row
const ROW_PAD = 10;
const DAY_MIN = 1440;

const SOURCE_LABEL: Record<CalShift["source"], string> = {
  DEFAULT: "기본 근무",
  UPDATED_MODIFY: "시간 변경",
  UPDATED_ADD: "추가 근무",
};

interface Item {
  shift: CalShift;
  topMin: number;
  endMin: number; // clamped to visible range end
  overnight: boolean;
  lane: number;
}

interface Props {
  date: string;
  shifts: CalShift[];
  staff: StaffLite[];
  selectedUserId: number | null;
  onShiftClick?: (s: CalShift) => void;
}

/** Greedy sub-lane packing so a person's overlapping shifts stack instead of
 *  covering each other. `items` must be sorted by start. */
function packLanes(items: Item[]): number {
  const laneEnds: number[] = [];
  for (const it of items) {
    let lane = laneEnds.findIndex((end) => end <= it.topMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.endMin);
    } else {
      laneEnds[lane] = it.endMin;
    }
    it.lane = lane;
  }
  return Math.max(1, laneEnds.length);
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

export function DayTimetable({ date, shifts, staff, selectedUserId, onShiftClick }: Props) {
  const dayShifts = shifts.filter((s) => s.date === date);

  // Visible hour window, tight to the data (min 6h, inside 0–24).
  let minH = 9;
  let maxH = 18;
  for (const s of dayShifts) {
    const start = kstClock(s.startAt).minutes;
    const end = Math.min(start + durationMinutes(s.startAt, s.endAt), DAY_MIN);
    minH = Math.min(minH, Math.floor(start / 60));
    maxH = Math.max(maxH, Math.ceil(end / 60));
  }
  const PAD_H = 1; // breathing room before the first / after the last shift
  minH = Math.max(0, minH - PAD_H);
  maxH = Math.min(24, Math.max(maxH + PAD_H, minH + 6));
  const hours = Array.from({ length: maxH - minH }, (_, i) => minH + i);
  const timeW = hours.length * HOUR_W;
  const xOf = (min: number) => ((min - minH * 60) / 60) * HOUR_W;

  const byUser = new Map<number, Item[]>();
  for (const s of dayShifts) {
    const start = kstClock(s.startAt).minutes;
    const rawEnd = start + durationMinutes(s.startAt, s.endAt);
    const item: Item = {
      shift: s,
      topMin: start,
      endMin: Math.min(rawEnd, maxH * 60),
      overnight: rawEnd > DAY_MIN,
      lane: 0,
    };
    const arr = byUser.get(s.userId);
    if (arr) arr.push(item);
    else byUser.set(s.userId, [item]);
  }

  const orderedStaff =
    selectedUserId != null ? staff.filter((s) => s.id === selectedUserId) : staff;
  const rows = orderedStaff
    .filter((s) => byUser.has(s.id))
    .map((s) => {
      const items = byUser.get(s.id)!.sort((a, b) => a.topMin - b.topMin);
      const lanes = packLanes(items);
      const totalMin = items.reduce(
        (sum, it) => sum + durationMinutes(it.shift.startAt, it.shift.endAt),
        0,
      );
      return { staff: s, items, lanes, totalMin };
    });

  if (rows.length === 0) {
    return <div className={styles.empty}>이 날 근무가 없습니다.</div>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.scroll}>
        <div className={styles.head}>
          <div className={styles.corner}>근무자</div>
          <div className={styles.hours} style={{ width: timeW }}>
            {hours.map((h, i) => (
              <span key={h} className={styles.hourLabel} style={{ left: i * HOUR_W }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
        </div>

        <div className={styles.rows}>
          {rows.map(({ staff: s, items, lanes, totalMin }) => (
            <div
              key={s.id}
              className={styles.row}
              style={{ height: lanes * LANE_H + ROW_PAD * 2 }}
            >
              <div className={styles.staffCell}>
                <i className={styles.dot} style={{ background: s.color }} />
                <span className={styles.staffName}>{s.name}</span>
                <span className={styles.staffSub}>{fmtDuration(totalMin)}</span>
              </div>

              <div
                className={styles.track}
                style={{ width: timeW, "--hw": `${HOUR_W}px` } as CSSProperties}
              >
                {items.map((it, idx) => {
                  const left = xOf(it.topMin);
                  const width = Math.max(xOf(it.endMin) - left, 46);
                  const range = `${kstClock(it.shift.startAt).label}–${kstClock(it.shift.endAt).label}`;
                  return (
                    <button
                      type="button"
                      key={idx}
                      className={styles.block}
                      style={
                        {
                          left,
                          width,
                          top: it.lane * LANE_H + ROW_PAD,
                          "--c": s.color,
                        } as CSSProperties
                      }
                      title={`${s.name} · ${range}${it.overnight ? " (익일까지)" : ""} · ${SOURCE_LABEL[it.shift.source]}`}
                      onClick={() => onShiftClick?.(it.shift)}
                    >
                      <span className={styles.bTime}>
                        <i className={styles.bDot} style={{ background: s.color }} />
                        {range}
                        {it.overnight && " ⏭"}
                      </span>
                      <b className={styles.bLabel}>{SOURCE_LABEL[it.shift.source]}</b>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
