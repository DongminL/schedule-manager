"use client";

import { Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState } from "react";

import type { StaffLite } from "@/components/CalendarView/CalendarView";
import { useSlidingIndicator } from "@/lib/useSlidingIndicator";
import type { ChangeType, RequestStatus } from "@/core/db/schema";

import { NewRequestDialog } from "./NewRequestDialog";
import { STATUS_KO } from "./labels";
import { RequestListBody } from "./RequestListBody";
import { RequestListSkeleton } from "./RequestListSkeleton";
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

const TABS: { label: string; value: RequestStatus | null }[] = [
  { label: "전체", value: null },
  { label: STATUS_KO.PENDING, value: "PENDING" },
  { label: STATUS_KO.WAITING_PEER_ACCEPT, value: "WAITING_PEER_ACCEPT" },
  { label: STATUS_KO.APPROVAL, value: "APPROVAL" },
  { label: STATUS_KO.REJECT, value: "REJECT" },
];

export function RequestList({
  rowsPromise,
  activeStatus,
  isManager,
  viewerId,
  roster,
}: {
  rowsPromise: Promise<RequestRow[]>;
  activeStatus: RequestStatus | null;
  isManager: boolean;
  viewerId: number;
  roster: StaffLite[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);

  const activeIndex = TABS.findIndex((t) => t.value === activeStatus);
  const tabSeg = useSlidingIndicator(activeIndex);

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
        <span
          className={styles.tabIndicator}
          style={tabSeg.style}
          data-ready={tabSeg.ready || undefined}
          data-moving={tabSeg.moving || undefined}
          aria-hidden="true"
        />
        {TABS.map((t, i) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            ref={tabSeg.setItemRef(i)}
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

      <Suspense fallback={<RequestListSkeleton />}>
        <RequestListBody rowsPromise={rowsPromise} />
      </Suspense>

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
