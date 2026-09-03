"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import type { StaffLite } from "@/components/CalendarView/CalendarView";
import type { ChangeType, RequestStatus } from "@/core/db/schema";

import { NewRequestDialog } from "./NewRequestDialog";
import styles from "./requests.module.scss";

export interface RequestRow {
  id: number;
  type: ChangeType;
  status: RequestStatus;
  updateDate: string;
  startHhmm: string;
  endHhmm: string;
  requesterName: string;
  reason: string;
  createdAt: string;
}

const TYPE_KO: Record<ChangeType, string> = {
  SHIFT: "대타",
  SWAP: "교환",
  TIME_ADJUST: "시간 변경",
};

const STATUS_KO: Record<RequestStatus, string> = {
  PENDING: "대기",
  WAITING_PEER_ACCEPT: "상대 수락 대기",
  APPROVAL: "승인",
  REJECT: "거절",
};

const TABS: { label: string; value: RequestStatus | null }[] = [
  { label: "전체", value: null },
  { label: "대기", value: "PENDING" },
  { label: "상대 수락 대기", value: "WAITING_PEER_ACCEPT" },
  { label: "승인", value: "APPROVAL" },
  { label: "거절", value: "REJECT" },
];

export function RequestList({
  rows,
  activeStatus,
  isManager,
  viewerId,
  roster,
}: {
  rows: RequestRow[];
  activeStatus: RequestStatus | null;
  isManager: boolean;
  viewerId: number;
  roster: StaffLite[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);

  return (
    <section className={styles.wrap}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>변경요청</h2>
        <span className={styles.roleHint}>
          {isManager ? "전체 요청 · 승인/거절" : "내 요청과 내가 관련된 요청"}
        </span>
        <button type="button" className={styles.newBtn} onClick={() => setCreating(true)}>
          <Plus size={15} /> 변경 요청
        </button>
      </div>

      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={activeStatus === t.value}
            className={activeStatus === t.value ? styles.tabActive : styles.tab}
            onClick={() =>
              router.push(t.value ? `${pathname}?status=${t.value}` : pathname)
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty}>해당하는 요청이 없습니다.</p>
      ) : (
        <ul className={styles.cardList}>
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/requests/${r.id}`} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.typeBadge} data-type={r.type}>
                    {TYPE_KO[r.type]}
                  </span>
                  <span className={styles.statusBadge} data-status={r.status}>
                    {STATUS_KO[r.status]}
                  </span>
                </div>
                <div className={styles.cardMain}>
                  <strong>{r.requesterName}</strong>
                  <span className={styles.cardWhen}>
                    {r.updateDate} · {r.startHhmm}–{r.endHhmm}
                  </span>
                </div>
                <p className={styles.cardReason}>{r.reason}</p>
                <span className={styles.cardMeta}>신청 {r.createdAt}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <NewRequestDialog
          viewerId={viewerId}
          roster={roster}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
