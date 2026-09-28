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

export interface RequestPageData {
  rows: RequestRow[];
  totalPages: number;
}

const TABS: { label: string; value: RequestStatus | null }[] = [
  { label: "전체", value: null },
  { label: STATUS_KO.PENDING, value: "PENDING" },
  { label: STATUS_KO.WAITING_PEER_ACCEPT, value: "WAITING_PEER_ACCEPT" },
  { label: STATUS_KO.APPROVAL, value: "APPROVAL" },
  { label: STATUS_KO.REJECT, value: "REJECT" },
];

/** Builds the `/requests` URL for a given status/page, omitting default values. */
export function buildRequestsHref(
  pathname: string,
  status: RequestStatus | null,
  pageNo?: number,
): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (pageNo && pageNo > 1) params.set("pageNo", String(pageNo));
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function RequestList({
  rowsPromise,
  activeStatus,
  pageNo,
  isManager,
  viewerId,
  roster,
}: {
  rowsPromise: Promise<RequestPageData>;
  activeStatus: RequestStatus | null;
  pageNo: number;
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
        <h2 className={styles.title}>변경 요청</h2>
        <span className={styles.roleHint}>
          {isManager ? "전체 변경 요청 · 승인/거절" : "나의 요청 · 나에게 온 요청"}
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
            onClick={() => router.push(buildRequestsHref(pathname, t.value))}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Suspense fallback={<RequestListSkeleton />}>
        <RequestListBody rowsPromise={rowsPromise} activeStatus={activeStatus} pageNo={pageNo} />
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
