"use client";

import { useState } from "react";

import form from "@/components/ui/form.module.scss";
import { ApiError, apiSend } from "@/lib/api";
import { addDays, kstClock, shiftInstants } from "@/lib/calendar";

import type { CalShift } from "../CalendarView";

type Scope = "ONE" | "FUTURE" | "ALL";
type Step = "scope" | "detail";

const SCOPE_LABEL: Record<Scope, string> = {
  ONE: "해당 날짜만",
  FUTURE: "이후 일정 모두",
  ALL: "전체 반복 일정",
};

const MODIFY_HINT: Record<Scope, string> = {
  ONE: "선택한 날짜의 근무 시간만 변경합니다.",
  FUTURE: "선택한 날짜부터의 반복 근무 시간이 변경됩니다. 이전 근무는 그대로 유지됩니다.",
  ALL: "이 반복 근무 전체의 시간이 변경됩니다.",
};

const CANCEL_HINT: Record<Scope, string> = {
  ONE: "선택한 날짜의 근무만 삭제됩니다.",
  FUTURE: "선택한 날짜 이후의 모든 반복 근무가 삭제됩니다. 이전 근무는 유지됩니다.",
  ALL: "이 반복 근무의 예정된 모든 일정이 사라집니다. 지난 근무 기록은 유지됩니다.",
};

const CANCEL_WARNING: Partial<Record<Scope, string>> = {
  FUTURE:
    "선택한 날짜 이후로 예정된 모든 반복 근무가 사라집니다. 이 작업은 되돌릴 수 없습니다.",
  ALL: "전체 반복 일정을 삭제하면 앞으로 예정된 모든 일정이 사라집니다. 이 작업은 되돌릴 수 없습니다.",
};

interface Props {
  shift: CalShift;
  kind: "MODIFY" | "CANCEL";
  onBack: () => void;
  onDone: () => void;
}

export function ManagerEditForm({ shift, kind, onBack, onDone }: Props) {
  const [step, setStep] = useState<Step>("scope");
  const [scope, setScope] = useState<Scope>("ONE");
  const [startHhmm, setStartHhmm] = useState(kstClock(shift.startAt).label);
  const [endHhmm, setEndHhmm] = useState(kstClock(shift.endAt).label);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function applyOne(): Promise<void> {
    if (kind === "MODIFY") {
      const t = shiftInstants(shift.date, startHhmm, endHhmm);
      await apiSend("POST", "/api/schedules/manager-edit", {
        kind: "MODIFY",
        defaultScheduleId: shift.defaultScheduleId,
        updateDate: shift.date,
        startAt: t.startAt,
        endAt: t.endAt,
      });
    } else {
      await apiSend("POST", "/api/schedules/manager-edit", {
        kind: "CANCEL",
        defaultScheduleId: shift.defaultScheduleId,
        updateDate: shift.date,
      });
    }
  }

  async function applyFuture(base: string): Promise<void> {
    if (kind === "MODIFY") {
      await apiSend("POST", `${base}/split`, { fromDate: shift.date, startHhmm, endHhmm });
    } else {
      await apiSend("DELETE", `${base}?endDate=${addDays(shift.date, -1)}`);
    }
  }

  async function applyAll(base: string): Promise<void> {
    if (kind === "MODIFY") {
      await apiSend("PATCH", base, { startHhmm, endHhmm });
    } else {
      await apiSend("DELETE", base);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const base = `/api/staff/${shift.userId}/default-schedules/${shift.defaultScheduleId}`;
      if (scope === "ONE") await applyOne();
      else if (scope === "FUTURE") await applyFuture(base);
      else await applyAll(base);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "처리에 실패했습니다.");
      setPending(false);
    }
  }

  if (step === "scope") {
    const hint = kind === "MODIFY" ? MODIFY_HINT[scope] : CANCEL_HINT[scope];
    return (
      <div className={form.form}>
        <fieldset className={form.field}>
          <span>적용 범위를 선택하세요</span>
          <div className={form.radioRow}>
            {(Object.keys(SCOPE_LABEL) as Scope[]).map((s) => (
              <label key={s} className={form.radioOption}>
                <input
                  type="radio"
                  name="scope"
                  checked={scope === s}
                  onChange={() => setScope(s)}
                />
                {SCOPE_LABEL[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <p className={form.hint}>{hint}</p>
        <div className={form.actions}>
          <button type="button" className={form.secondary} onClick={onBack}>
            뒤로
          </button>
          <button type="button" className={form.submit} onClick={() => setStep("detail")}>
            다음
          </button>
        </div>
      </div>
    );
  }

  if (kind === "MODIFY") {
    return (
      <form className={form.form} onSubmit={submit}>
        <p className={form.hint}>
          {SCOPE_LABEL[scope]} · {MODIFY_HINT[scope]}
        </p>
        <div className={form.row}>
          <label className={form.field}>
            <span>시작</span>
            <input
              type="time"
              value={startHhmm}
              onChange={(e) => setStartHhmm(e.target.value)}
              required
            />
          </label>
          <label className={form.field}>
            <span>종료</span>
            <input
              type="time"
              value={endHhmm}
              onChange={(e) => setEndHhmm(e.target.value)}
              required
            />
          </label>
        </div>

        {error && <p className={form.error}>{error}</p>}

        <div className={form.actions}>
          <button type="button" className={form.secondary} onClick={() => setStep("scope")}>
            뒤로
          </button>
          <button type="submit" className={form.submit} disabled={pending}>
            {pending ? "처리 중…" : "수정 반영"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className={form.form} onSubmit={submit}>
      <p className={form.hint}>
        {SCOPE_LABEL[scope]} · {CANCEL_HINT[scope]}
      </p>
      {CANCEL_WARNING[scope] && <p className={form.error}>{CANCEL_WARNING[scope]}</p>}
      <p className={form.hint}>정말로 삭제하시겠습니까?</p>

      {error && <p className={form.error}>{error}</p>}

      <div className={form.actions}>
        <button type="button" className={form.secondary} onClick={() => setStep("scope")}>
          뒤로
        </button>
        <button type="submit" className={form.danger} disabled={pending}>
          {pending ? "삭제 중…" : "삭제"}
        </button>
      </div>
    </form>
  );
}
