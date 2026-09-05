"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import form from "@/components/ui/form.module.scss";
import type { CalShift, StaffLite } from "@/components/CalendarView/CalendarView";
import { ShiftCalendarPicker } from "@/components/CalendarView/forms/ShiftCalendarPicker";
import { SubstituteForm } from "@/components/CalendarView/forms/SubstituteForm";
import { SwapForm } from "@/components/CalendarView/forms/SwapForm";
import { TimeAdjustForm } from "@/components/CalendarView/forms/TimeAdjustForm";
import { keyOf } from "@/components/CalendarView/forms/shared";
import formStyles from "@/components/CalendarView/forms/forms.module.scss";
import { kstClock } from "@/lib/calendar";

type Step = "pick" | "type" | "time" | "sub" | "swap";

interface Props {
  viewerId: number;
  roster: StaffLite[];
  onClose: () => void;
  onDone: () => void;
}

export function NewRequestDialog({ viewerId, roster, onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>("pick");
  const [shift, setShift] = useState<CalShift | null>(null);

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
        <ShiftCalendarPicker
          mode="own"
          viewerId={viewerId}
          roster={roster}
          selectedKey={shift ? keyOf(shift) : ""}
          onSelect={(s) => {
            setShift(s);
            setStep("type");
          }}
        />
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
          <div className={form.actions}>
            <button type="button" className={form.secondary} onClick={() => setStep("pick")}>
              뒤로
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
