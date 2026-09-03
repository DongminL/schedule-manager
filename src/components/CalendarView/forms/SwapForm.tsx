"use client";

import { useEffect, useState } from "react";

import form from "@/components/ui/form.module.scss";
import { ApiError, apiGet, apiSend } from "@/lib/api";
import { addDays, kstClock } from "@/lib/calendar";

import type { CalShift, StaffLite } from "../CalendarView";
import { peerTargetRef, targetRef } from "./shared";

interface Props {
  shift: CalShift;
  roster: StaffLite[];
  viewerId: number;
  onBack: () => void;
  onDone: () => void;
}

export function SwapForm({ shift, roster, viewerId, onBack, onDone }: Props) {
  const others = roster.filter((r) => r.id !== viewerId);
  const [peerId, setPeerId] = useState(String(others[0]?.id ?? ""));
  const [peerShifts, setPeerShifts] = useState<CalShift[]>([]);
  const [peerShiftKey, setPeerShiftKey] = useState("");
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const from = addDays(shift.date, -14);
  const to = addDays(shift.date, 14);

  useEffect(() => {
    if (!peerId) return;
    const ctrl = new AbortController();
    // Data-fetching effect: reset the picker to a loading state, then load the
    // peer's shifts for the new selection. Aborted on cleanup.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoadingShifts(true);
    setPeerShifts([]);
    setPeerShiftKey("");
    /* eslint-enable react-hooks/set-state-in-effect */
    apiGet<{ shifts: CalShift[] }>(`/api/schedules?userId=${peerId}&from=${from}&to=${to}`)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setPeerShifts(res.shifts);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setError("상대 근무를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadingShifts(false);
      });
    return () => ctrl.abort();
  }, [peerId, from, to]);

  const keyOf = (s: CalShift) => `${s.date}|${s.startAt}`;
  const picked = peerShifts.find((s) => keyOf(s) === peerShiftKey);

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
        peerUserId: Number(peerId),
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

  return (
    <form className={form.form} onSubmit={handleSubmit}>
      <label className={form.field}>
        <span>교환 상대</span>
        <select value={peerId} onChange={(e) => setPeerId(e.target.value)}>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>

      <label className={form.field}>
        <span>상대의 근무 (±14일)</span>
        <select
          value={peerShiftKey}
          onChange={(e) => setPeerShiftKey(e.target.value)}
          disabled={loadingShifts || peerShifts.length === 0}
        >
          <option value="">
            {loadingShifts
              ? "불러오는 중…"
              : peerShifts.length === 0
                ? "해당 기간에 근무 없음"
                : "선택하세요"}
          </option>
          {peerShifts.map((s) => (
            <option key={keyOf(s)} value={keyOf(s)}>
              {s.date} · {kstClock(s.startAt).label}–{kstClock(s.endAt).label}
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

      <p className={form.hint}>상대의 수락 후 매니저 승인이 필요합니다 (이중 승인).</p>
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
