"use client";

import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { DayOfWeek, Role } from "@/core/db/schema";
import { ApiError, apiSend } from "@/lib/api";
import { roleLabel } from "@/lib/roleLabel";

import { StaffFormDialog } from "../StaffFormDialog";
import { DefaultScheduleForm } from "./DefaultScheduleForm";
import styles from "./detail.module.scss";

const DOW_KO: Record<DayOfWeek, string> = {
  SUN: "일",
  MON: "월",
  TUE: "화",
  WED: "수",
  THU: "목",
  FRI: "금",
  SAT: "토",
};
const DOW_ORDER: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export interface PatternRow {
  id: number;
  dayOfWeek: DayOfWeek;
  startHhmm: string;
  endHhmm: string;
  startDate: string;
  endDate: string | null;
}

interface StaffInfo {
  id: number;
  name: string;
  phoneNumber: string;
  color: string;
  role: Role;
  isActive: boolean;
}

type PatternDialog = { mode: "create" } | { mode: "edit"; row: PatternRow } | null;

export function StaffDetail({
  staff,
  patterns,
}: {
  staff: StaffInfo;
  patterns: PatternRow[];
}) {
  const router = useRouter();
  const [editingStaff, setEditingStaff] = useState(false);
  const [patternDialog, setPatternDialog] = useState<PatternDialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...patterns].sort(
    (a, b) =>
      DOW_ORDER.indexOf(a.dayOfWeek) - DOW_ORDER.indexOf(b.dayOfWeek) ||
      a.startHhmm.localeCompare(b.startHhmm),
  );

  async function run(fn: () => Promise<void>, keepBusy = false) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "처리에 실패했습니다.");
      setBusy(false);
      return;
    }
    if (!keepBusy) setBusy(false);
  }

  const deactivate = () =>
    confirm(`${staff.name} 님을 비활성화할까요? 과거 근무 기록은 유지됩니다.`) &&
    run(async () => {
      await apiSend("DELETE", `/api/staff/${staff.id}`);
      router.push("/staff");
      router.refresh();
    }, true);

  const reactivate = () =>
    run(async () => {
      await apiSend("PATCH", `/api/staff/${staff.id}`, { isActive: true });
      router.refresh();
    });

  const endRecurrence = (row: PatternRow) => {
    const today = new Date().toISOString().slice(0, 10);
    const date = prompt("이 날짜 이후로 반복 종료 (YYYY-MM-DD)", row.endDate ?? today);
    if (!date) return;
    void run(async () => {
      await apiSend(
        "DELETE",
        `/api/staff/${staff.id}/default-schedules/${row.id}?endDate=${date}`,
      );
      router.refresh();
    });
  };

  return (
    <section className={styles.wrap}>
      <Link href="/staff" className={styles.back}>
        ← 직원 목록
      </Link>

      <div className={styles.card}>
        <div className={styles.headRow}>
          <div className={styles.identity}>
            <i className={styles.dot} style={{ background: staff.color }} />
            <div>
              <h2>{staff.name}</h2>
              <p className={styles.sub}>
                {staff.phoneNumber} · {roleLabel(staff.role)} ·{" "}
                {staff.isActive ? "활성" : "비활성"}
              </p>
            </div>
          </div>
          <div className={styles.headActions}>
            <button type="button" className={styles.iconBtn} onClick={() => setEditingStaff(true)}>
              <Pencil size={15} /> 수정
            </button>
            {staff.role !== "MANAGER" &&
              (staff.isActive ? (
                <button
                  type="button"
                  className={styles.dangerBtn}
                  onClick={deactivate}
                  disabled={busy}
                >
                  비활성화
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={reactivate}
                  disabled={busy}
                >
                  다시 활성화
                </button>
              ))}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.headRow}>
          <h3>기본 근무 패턴</h3>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setPatternDialog({ mode: "create" })}
          >
            <Plus size={15} /> 패턴 추가
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {sorted.length === 0 ? (
          <p className={styles.emptyPatterns}>등록된 반복 근무가 없습니다.</p>
        ) : (
          <ul className={styles.patternList}>
            {sorted.map((p) => (
              <li key={p.id} className={styles.patternRow}>
                <span className={styles.dow}>{DOW_KO[p.dayOfWeek]}</span>
                <span className={styles.time}>
                  {p.startHhmm}–{p.endHhmm}
                </span>
                <span className={styles.range}>
                  {p.startDate}
                  {p.endDate ? ` ~ ${p.endDate}` : " ~"}
                </span>
                <span className={styles.rowActions}>
                  <button
                    type="button"
                    onClick={() => setPatternDialog({ mode: "edit", row: p })}
                  >
                    수정
                  </button>
                  <button type="button" onClick={() => endRecurrence(p)} disabled={busy}>
                    반복 종료
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <StaffFormDialog
        open={editingStaff}
        onClose={() => setEditingStaff(false)}
        onSaved={() => {
          setEditingStaff(false);
          router.refresh();
        }}
        initial={{
          id: staff.id,
          name: staff.name,
          phoneNumber: staff.phoneNumber,
          color: staff.color,
        }}
      />

      {patternDialog && (
        <DefaultScheduleForm
          staffId={staff.id}
          initial={patternDialog.mode === "edit" ? patternDialog.row : undefined}
          onClose={() => setPatternDialog(null)}
          onSaved={() => {
            setPatternDialog(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
