"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import form from "@/components/ui/form.module.scss";
import { ApiError, apiSend } from "@/lib/api";
import { shiftInstants } from "@/lib/kst";

import type { StaffLite } from "../CalendarView";

interface Props {
  date: string;
  roster: StaffLite[];
  onClose: () => void;
  onDone: () => void;
}

export function AddShiftDialog({ date, roster, onClose, onDone }: Props) {
  const [userId, setUserId] = useState(String(roster[0]?.id ?? ""));
  const [updateDate, setUpdateDate] = useState(date);
  const [startHhmm, setStartHhmm] = useState("09:00");
  const [endHhmm, setEndHhmm] = useState("18:00");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      setError("근무자를 선택하세요.");
      return;
    }
    setError(null);
    setPending(true);
    const t = shiftInstants(updateDate, startHhmm, endHhmm);
    try {
      await apiSend("POST", "/api/schedules/manager-edit", {
        kind: "ADD",
        userId: Number(userId),
        updateDate,
        startAt: t.startAt,
        endAt: t.endAt,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "추가에 실패했습니다.");
      setPending(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="근무 추가 (즉시)">
      <form className={form.form} onSubmit={submit}>
        <label className={form.field}>
          <span>근무자</span>
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            {roster.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className={form.field}>
          <span>날짜</span>
          <input
            type="date"
            value={updateDate}
            onChange={(e) => setUpdateDate(e.target.value)}
            required
          />
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

        {error && <p className={form.error}>{error}</p>}

        <div className={form.actions}>
          <button type="button" className={form.secondary} onClick={onClose}>
            취소
          </button>
          <button type="submit" className={form.submit} disabled={pending}>
            {pending ? "추가 중…" : "추가"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
