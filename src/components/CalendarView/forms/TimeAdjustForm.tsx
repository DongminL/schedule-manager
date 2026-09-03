"use client";

import { useState } from "react";

import form from "@/components/ui/form.module.scss";
import { ApiError, apiSend } from "@/lib/api";
import { kstClock, shiftInstants } from "@/lib/calendar";

import type { CalShift } from "../CalendarView";
import { targetRef } from "./shared";

interface Props {
  shift: CalShift;
  onBack: () => void;
  onDone: () => void;
}

export function TimeAdjustForm({ shift, onBack, onDone }: Props) {
  const [startHhmm, setStartHhmm] = useState(kstClock(shift.startAt).label);
  const [endHhmm, setEndHhmm] = useState(kstClock(shift.endAt).label);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const adjust = shiftInstants(shift.date, startHhmm, endHhmm);
    try {
      await apiSend("POST", "/api/schedule-changes", {
        type: "TIME_ADJUST",
        updateDate: shift.date,
        startAt: shift.startAt,
        endAt: shift.endAt,
        reason,
        adjustStartAt: adjust.startAt,
        adjustEndAt: adjust.endAt,
        ...targetRef(shift),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "신청에 실패했습니다.");
      setPending(false);
    }
  }

  return (
    <form className={form.form} onSubmit={handleSubmit}>
      <div className={form.row}>
        <label className={form.field}>
          <span>변경할 시작</span>
          <input
            type="time"
            value={startHhmm}
            onChange={(e) => setStartHhmm(e.target.value)}
            required
          />
        </label>
        <label className={form.field}>
          <span>변경할 종료</span>
          <input
            type="time"
            value={endHhmm}
            onChange={(e) => setEndHhmm(e.target.value)}
            required
          />
        </label>
      </div>
      <label className={form.field}>
        <span>사유</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          maxLength={500}
        />
      </label>

      {error && <p className={form.error}>{error}</p>}

      <div className={form.actions}>
        <button type="button" className={form.secondary} onClick={onBack}>
          뒤로
        </button>
        <button type="submit" className={form.submit} disabled={pending}>
          {pending ? "신청 중…" : "신청"}
        </button>
      </div>
    </form>
  );
}
