"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

import { roleLabel } from "@/lib/roleLabel";

import type { StaffGroups, StaffRow, StaffTab } from "./StaffTable";
import styles from "./staff.module.scss";

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

function StaffSection({
  variant,
  rows,
  onRowClick,
}: {
  variant: StaffTab;
  rows: StaffRow[];
  onRowClick: (e: React.MouseEvent<HTMLTableRowElement>, id: number) => void;
}) {
  const isResigned = variant === "resigned";
  const emptyLabel = isResigned ? "퇴사한 직원이 없습니다." : "재직 중인 직원이 없습니다.";
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>이름</th>
            <th>연락처</th>
            <th>역할</th>
            <th>{isResigned ? "퇴사일" : "상태"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className={styles.empty}>
                {emptyLabel}
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} onClick={(e) => onRowClick(e, r.id)}>
              <td>
                <Link href={`/staff/${r.id}`} className={styles.nameLink}>
                  <i className={styles.dot} style={{ background: r.color }} />
                  {r.name}
                </Link>
              </td>
              <td className={styles.mono}>{r.phoneNumber}</td>
              <td>{roleLabel(r.role)}</td>
              {isResigned ? (
                <td className={styles.mono}>{formatDate(r.updatedAt)}</td>
              ) : (
                <td>
                  {r.isActive ? (
                    <span
                      className={styles.badgeOk}
                      title={r.mustChangePassword ? "비번 변경 대기" : undefined}
                    >
                      {r.mustChangePassword ? "임시" : "활성"}
                    </span>
                  ) : (
                    <span className={styles.badgeOff}>퇴사</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Unwraps the streamed, grouped staff rows so the toolbar/tabs can render before they arrive. */
export function StaffTableBody({
  rowsPromise,
  tab,
}: {
  rowsPromise: Promise<StaffGroups>;
  tab: StaffTab;
}) {
  const { active, resigned } = use(rowsPromise);
  const router = useRouter();

  /**
   * Row-wide click convenience for mouse/touch;
   * the Link in the name cell already covers keyboard/screen readers.
   */
  function handleRowClick(e: React.MouseEvent<HTMLTableRowElement>, id: number) {
    if (e.target instanceof HTMLElement && e.target.closest("a")) return;
    router.push(`/staff/${id}`);
  }

  const rows = tab === "active" ? active : resigned;
  return <StaffSection variant={tab} rows={rows} onRowClick={handleRowClick} />;
}
