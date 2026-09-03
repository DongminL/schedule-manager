"use client";

import { useState } from "react";

import form from "@/components/ui/form.module.scss";
import { ApiError, apiSend } from "@/lib/api";

import type { CalShift, StaffLite } from "../CalendarView";
import { targetRef } from "./shared";

interface Props {
  shift: CalShift;
  roster: StaffLite[];
  viewerId: number;
  onBack: () => void;
  onDone: () => void;
}

export function SubstituteForm({ shift, roster, viewerId, onBack, onDone }: Props) {
  const others = roster.filter((r) => r.id !== viewerId);
  const [substituteUserId, setSubstituteUserId] = useState(String(others[0]?.id ?? ""));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!substituteUserId) {
      setError("대타 근무자를 선택하세요.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await apiSend("POST", "/api/schedule-changes", {
        type: "SHIFT",
        updateDate: shift.date,
        startAt: shift.startAt,
        endAt: shift.endAt,
        reason,
        substituteUserId: Number(substituteUserId),
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
      <label className={form.field}>
        <span>대타 근무자</span>
        <select value={substituteUserId} onChange={(e) => setSubstituteUserId(e.target.value)}>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
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
