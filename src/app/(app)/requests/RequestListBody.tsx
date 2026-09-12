"use client";

import Link from "next/link";
import { use } from "react";

import { STATUS_KO, TYPE_KO } from "./labels";
import type { RequestRow } from "./RequestList";
import styles from "./requests.module.scss";

/** Unwraps the streamed request rows so the header/tabs can render before they arrive. */
export function RequestListBody({ rowsPromise }: { rowsPromise: Promise<RequestRow[]> }) {
  const rows = use(rowsPromise);

  if (rows.length === 0) {
    return <p className={styles.empty}>해당하는 요청이 없습니다.</p>;
  }

  return (
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
  );
}
