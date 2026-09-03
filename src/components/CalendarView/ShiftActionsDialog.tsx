"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { kstClock } from "@/lib/calendar";

import type { CalShift, StaffLite } from "./CalendarView";
import { ManagerEditForm } from "./forms/ManagerEditForm";
import { SubstituteForm } from "./forms/SubstituteForm";
import { SwapForm } from "./forms/SwapForm";
import { TimeAdjustForm } from "./forms/TimeAdjustForm";
import styles from "./forms/forms.module.scss";

type Mode = "menu" | "time" | "sub" | "swap" | "mgrModify" | "mgrCancel";

interface Props {
  shift: CalShift;
  viewerId: number;
  isManager: boolean;
  staffName: string;
  roster: StaffLite[];
  onClose: () => void;
  onDone: () => void;
}

export function ShiftActionsDialog({
  shift,
  viewerId,
  isManager,
  staffName,
  roster,
  onClose,
  onDone,
}: Props) {
  const [mode, setMode] = useState<Mode>("menu");
  const isOwn = shift.userId === viewerId;
  const canManagerEdit = isManager && shift.defaultScheduleId != null;
  const range = `${kstClock(shift.startAt).label}–${kstClock(shift.endAt).label}`;
  const back = () => setMode("menu");

  const title =
    mode === "menu"
      ? "근무 상세"
      : mode === "time"
        ? "시간 변경 신청"
        : mode === "sub"
          ? "대타 신청"
          : mode === "swap"
            ? "교환 신청"
            : mode === "mgrModify"
              ? "직접 시간 수정"
              : "이 날 근무 취소";

  return (
    <Modal open onClose={onClose} title={title}>
      <div className={styles.shiftHead}>
        <strong>{staffName}</strong>
        <span>
          {shift.date} · {range}
        </span>
      </div>

      {mode === "menu" && (
        <div className={styles.menu}>
          {isOwn ? (
            <>
              <button type="button" onClick={() => setMode("time")}>
                시간 변경 신청
              </button>
              <button type="button" onClick={() => setMode("sub")}>
                대타 신청
              </button>
              <button type="button" onClick={() => setMode("swap")}>
                교환 신청
              </button>
            </>
          ) : (
            <p className={styles.note}>다른 근무자의 근무입니다.</p>
          )}
          {canManagerEdit && (
            <>
              <button type="button" onClick={() => setMode("mgrModify")}>
                직접 시간 수정 (즉시)
              </button>
              <button
                type="button"
                className={styles.dangerText}
                onClick={() => setMode("mgrCancel")}
              >
                이 날 근무 취소 (즉시)
              </button>
            </>
          )}
        </div>
      )}

      {mode === "time" && <TimeAdjustForm shift={shift} onBack={back} onDone={onDone} />}
      {mode === "sub" && (
        <SubstituteForm
          shift={shift}
          roster={roster}
          viewerId={viewerId}
          onBack={back}
          onDone={onDone}
        />
      )}
      {mode === "swap" && (
        <SwapForm
          shift={shift}
          roster={roster}
          viewerId={viewerId}
          onBack={back}
          onDone={onDone}
        />
      )}
      {mode === "mgrModify" && (
        <ManagerEditForm shift={shift} kind="MODIFY" onBack={back} onDone={onDone} />
      )}
      {mode === "mgrCancel" && (
        <ManagerEditForm shift={shift} kind="CANCEL" onBack={back} onDone={onDone} />
      )}
    </Modal>
  );
}
