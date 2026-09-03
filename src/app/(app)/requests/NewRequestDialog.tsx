"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import type { CalShift, StaffLite } from "@/components/CalendarView/CalendarView";
import { SubstituteForm } from "@/components/CalendarView/forms/SubstituteForm";
import { SwapForm } from "@/components/CalendarView/forms/SwapForm";
import { TimeAdjustForm } from "@/components/CalendarView/forms/TimeAdjustForm";
import formStyles from "@/components/CalendarView/forms/forms.module.scss";
import { apiGet } from "@/lib/api";
import { kstClock } from "@/lib/calendar";

type Step = "pick" | "type" | "time" | "sub" | "swap";

function kstToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

interface Props {
  viewerId: number;
  roster: StaffLite[];
  onClose: () => void;
  onDone: () => void;
}

export function NewRequestDialog({ viewerId, roster, onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>("pick");
  const [shifts, setShifts] = useState<CalShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState("");

  const from = addDays(kstToday(), -1);
  const to = addDays(kstToday(), 30);

  useEffect(() => {
    const ctrl = new AbortController();
    apiGet<{ shifts: CalShift[] }>(`/api/schedules?userId=${viewerId}&from=${from}&to=${to}`)
      .then((res) => !ctrl.signal.aborted && setShifts(res.shifts))
      .catch(() => {})
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [viewerId, from, to]);

  const keyOf = (s: CalShift) => `${s.date}|${s.startAt}`;
  const shift = shifts.find((s) => keyOf(s) === key) ?? null;

  const title =
    step === "pick"
      ? "변경 요청할 근무 선택"
      : step === "type"
        ? "요청 유형 선택"
        : step === "time"
          ? "시간 변경 신청"
          : step === "sub"
            ? "대타 신청"
            : "교환 신청";

  return (
    <Modal open onClose={onClose} title={title}>
      {step === "pick" && (
        <div className={formStyles.menu}>
          {loading ? (
            <p className={formStyles.note}>불러오는 중…</p>
          ) : shifts.length === 0 ? (
            <p className={formStyles.note}>앞으로 30일 이내에 신청할 내 근무가 없습니다.</p>
          ) : (
            shifts
              .slice()
              .sort((a, b) => a.startAt.localeCompare(b.startAt))
              .map((s) => (
                <button
                  key={keyOf(s)}
                  type="button"
                  onClick={() => {
                    setKey(keyOf(s));
                    setStep("type");
                  }}
                >
                  {s.date} · {kstClock(s.startAt).label}–{kstClock(s.endAt).label}
                </button>
              ))
          )}
        </div>
      )}

      {step === "type" && shift && (
        <>
          <div className={formStyles.shiftHead}>
            <strong>내 근무</strong>
            <span>
              {shift.date} · {kstClock(shift.startAt).label}–{kstClock(shift.endAt).label}
            </span>
          </div>
          <div className={formStyles.menu}>
            <button type="button" onClick={() => setStep("time")}>
              시간 변경 신청
            </button>
            <button type="button" onClick={() => setStep("sub")}>
              대타 신청
            </button>
            <button type="button" onClick={() => setStep("swap")}>
              교환 신청
            </button>
          </div>
        </>
      )}

      {step === "time" && shift && (
        <TimeAdjustForm shift={shift} onBack={() => setStep("type")} onDone={onDone} />
      )}
      {step === "sub" && shift && (
        <SubstituteForm
          shift={shift}
          roster={roster}
          viewerId={viewerId}
          onBack={() => setStep("type")}
          onDone={onDone}
        />
      )}
      {step === "swap" && shift && (
        <SwapForm
          shift={shift}
          roster={roster}
          viewerId={viewerId}
          onBack={() => setStep("type")}
          onDone={onDone}
        />
      )}
    </Modal>
  );
}
