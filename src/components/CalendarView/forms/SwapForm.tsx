"use client";

import { useState } from "react";

import form from "@/components/ui/form.module.scss";
import { ApiError, apiSend } from "@/lib/api";
import { kstClock } from "@/lib/calendar";

import type { CalShift, StaffLite } from "../CalendarView";
import { ShiftCalendarPicker } from "./ShiftCalendarPicker";
import formStyles from "./forms.module.scss";
import { keyOf, peerTargetRef, targetRef } from "./shared";

interface Props {
  shift: CalShift;
  roster: StaffLite[];
  viewerId: number;
  onBack: () => void;
  onDone: () => void;
}

type Step = "pick" | "confirm";

export function SwapForm({ shift, roster, viewerId, onBack, onDone }: Props) {
  const [step, setStep] = useState<Step>("pick");
  const [picked, setPicked] = useState<CalShift | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const peerName = picked
    ? (roster.find((r) => r.id === picked.userId)?.name ?? `#${picked.userId}`)
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) {
      setError("교환할 상대 근무를 선택하세요.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await apiSend("POST", "/api/schedule-changes", {
        type: "SWAP",
        updateDate: shift.date,
        startAt: shift.startAt,
        endAt: shift.endAt,
        reason,
        peerUserId: picked.userId,
        peerUpdateDate: picked.date,
        peerStartAt: picked.startAt,
        peerEndAt: picked.endAt,
        ...targetRef(shift),
        ...peerTargetRef(picked),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "신청에 실패했습니다.");
      setPending(false);
    }
  }

  if (step === "pick") {
    return (
      <div className={form.form}>
        <div className={form.field}>
          <span>상대의 근무를 선택하세요</span>
          <ShiftCalendarPicker
            mode="all"
            viewerId={viewerId}
            roster={roster}
            selectedKey={picked ? keyOf(picked) : ""}
            onSelect={(s) => {
              setPicked(s);
              setStep("confirm");
            }}
            initialAnchor={shift.date}
          />
        </div>

        <div className={form.actions}>
          <button type="button" className={form.secondary} onClick={onBack}>
            뒤로
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className={form.form} onSubmit={handleSubmit}>
      <div className={formStyles.shiftHead}>
        <strong>내 근무</strong>
        <span>
          {shift.date} · {kstClock(shift.startAt).label}–{kstClock(shift.endAt).label}
        </span>
      </div>
      {picked && (
        <div className={formStyles.shiftHead}>
          <strong>{peerName}의 근무</strong>
          <span>
            {picked.date} · {kstClock(picked.startAt).label}–{kstClock(picked.endAt).label}
          </span>
        </div>
      )}

      <label className={form.field}>
        <span>사유</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          maxLength={500}
        />
      </label>

      <p className={form.hint}>상대의 수락 후 매니저 승인이 필요합니다 (이중 승인).</p>
      {error && <p className={form.error}>{error}</p>}

      <div className={form.actions}>
        <button type="button" className={form.secondary} onClick={() => setStep("pick")}>
          다시 선택
        </button>
        <button type="submit" className={form.submit} disabled={pending}>
          {pending ? "신청 중…" : "신청"}
        </button>
      </div>
    </form>
  );
}
