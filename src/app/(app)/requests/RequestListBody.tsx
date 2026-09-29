"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { use } from "react";

import { Pagination } from "@/components/ui/Pagination";
import type { RequestStatus } from "@/core/db/schema";

import { STATUS_KO, TYPE_KO } from "./labels";
import { buildRequestsHref, type RequestPageData } from "./RequestList";
import styles from "./requests.module.scss";

/** Unwraps the streamed request rows so the header/tabs can render before they arrive. */
export function RequestListBody({
  rowsPromise,
  activeStatus,
  pageNo,
}: {
  rowsPromise: Promise<RequestPageData>;
  activeStatus: RequestStatus | null;
  pageNo: number;
}) {
  const { rows, totalPages } = use(rowsPromise);
  const router = useRouter();
  const pathname = usePathname();

  return (
    <>
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
      <Pagination
        pageNo={pageNo}
        totalPages={totalPages}
        onNavigate={(n) => router.push(buildRequestsHref(pathname, activeStatus, n))}
      />
    </>
  );
}
