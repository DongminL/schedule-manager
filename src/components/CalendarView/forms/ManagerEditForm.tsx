"use client";

import { useState } from "react";

import form from "@/components/ui/form.module.scss";
import { ApiError, apiSend } from "@/lib/api";
import { isoToHhmm, shiftInstants } from "@/lib/kst";

import type { CalShift } from "../CalendarView";

interface Props {
  shift: CalShift;
  kind: "MODIFY" | "CANCEL";
  onBack: () => void;
  onDone: () => void;
}

export function ManagerEditForm({ shift, kind, onBack, onDone }: Props) {
  const [startHhmm, setStartHhmm] = useState(isoToHhmm(shift.startAt));
  const [endHhmm, setEndHhmm] = useState(isoToHhmm(shift.endAt));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
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
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "처리에 실패했습니다.");
      setPending(false);
    }
  }

  return (
    <form className={form.form} onSubmit={submit}>
      {kind === "MODIFY" ? (
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
      ) : (
        <p className={form.hint}>
          {shift.date} 의 이 근무를 취소합니다. 승인 절차 없이 즉시 반영됩니다.
        </p>
      )}

      {error && <p className={form.error}>{error}</p>}

      <div className={form.actions}>
        <button type="button" className={form.secondary} onClick={onBack}>
          뒤로
        </button>
        <button
          type="submit"
          className={kind === "CANCEL" ? form.danger : form.submit}
          disabled={pending}
        >
          {pending ? "처리 중…" : kind === "CANCEL" ? "근무 취소" : "수정 반영"}
        </button>
      </div>
    </form>
  );
}
