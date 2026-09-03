"use client";

import { useState } from "react";

import { DAYS_OF_WEEK, type DayOfWeek } from "@/core/db/schema";
import { Modal } from "@/components/ui/Modal";
import form from "@/components/ui/form.module.scss";
import { ApiError, apiSend } from "@/lib/api";

const DOW_KO: Record<DayOfWeek, string> = {
  SUN: "일요일",
  MON: "월요일",
  TUE: "화요일",
  WED: "수요일",
  THU: "목요일",
  FRI: "금요일",
  SAT: "토요일",
};

interface Initial {
  id: number;
  dayOfWeek: DayOfWeek;
  startHhmm: string;
  endHhmm: string;
  startDate: string;
  endDate: string | null;
}

interface Props {
  staffId: number;
  initial?: Initial;
  onClose: () => void;
  onSaved: () => void;
}

export function DefaultScheduleForm({ staffId, initial, onClose, onSaved }: Props) {
  const isEdit = !!initial;
  const today = new Date().toISOString().slice(0, 10);
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(initial?.dayOfWeek ?? "MON");
  const [startHhmm, setStartHhmm] = useState(initial?.startHhmm ?? "09:00");
  const [endHhmm, setEndHhmm] = useState(initial?.endHhmm ?? "18:00");
  const [startDate, setStartDate] = useState(initial?.startDate ?? today);
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const body = {
      dayOfWeek,
      startHhmm,
      endHhmm,
      startDate,
      endDate: endDate || null,
    };
    try {
      if (isEdit) {
        await apiSend("PATCH", `/api/staff/${staffId}/default-schedules/${initial.id}`, body);
      } else {
        await apiSend("POST", `/api/staff/${staffId}/default-schedules`, body);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "저장에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "반복 근무 수정" : "반복 근무 추가"}>
      <form className={form.form} onSubmit={handleSubmit}>
        <label className={form.field}>
          <span>요일</span>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
          >
            {DAYS_OF_WEEK.map((d) => (
              <option key={d} value={d}>
                {DOW_KO[d]}
              </option>
            ))}
          </select>
        </label>

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
        <p className={form.hint}>종료가 시작보다 빠르면 익일 근무로 저장됩니다.</p>

        <div className={form.row}>
          <label className={form.field}>
            <span>반복 시작일</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
          <label className={form.field}>
            <span>반복 종료일 (선택)</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>

        {error && <p className={form.error}>{error}</p>}

        <div className={form.actions}>
          <button type="button" className={form.secondary} onClick={onClose}>
            취소
          </button>
          <button type="submit" className={form.submit} disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
