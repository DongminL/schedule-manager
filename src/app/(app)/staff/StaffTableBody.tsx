"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { use } from "react";

import { Pagination } from "@/components/ui/Pagination";
import { roleLabel } from "@/lib/roleLabel";

import type { StaffPageData, StaffRow, StaffTab } from "./StaffTable";
import styles from "./staff.module.scss";

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

const MAX_NAME_LENGTH = 4;

function truncateName(name: string) {
  const chars = Array.from(name);
  return chars.length > MAX_NAME_LENGTH ? `${chars.slice(0, MAX_NAME_LENGTH).join("")}…` : name;
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
                <Link href={`/staff/${r.id}`} className={styles.nameLink} title={r.name}>
                  <i className={styles.dot} style={{ background: r.color }} />
                  {truncateName(r.name)}
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

/** Unwraps the streamed, paginated staff rows so the toolbar/tabs can render before they arrive. */
export function StaffTableBody({
  pagePromise,
  tab,
  pageNo,
}: {
  pagePromise: Promise<StaffPageData>;
  tab: StaffTab;
  pageNo: number;
}) {
  const { rows, totalPages } = use(pagePromise);
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Row-wide click convenience for mouse/touch;
   * the Link in the name cell already covers keyboard/screen readers.
   */
  function handleRowClick(e: React.MouseEvent<HTMLTableRowElement>, id: number) {
    if (e.target instanceof HTMLElement && e.target.closest("a")) return;
    router.push(`/staff/${id}`);
  }

  function goToPage(n: number) {
    router.push(`${pathname}?tab=${tab}&pageNo=${n}`);
  }

  return (
    <>
      <StaffSection variant={tab} rows={rows} onRowClick={handleRowClick} />
      <Pagination pageNo={pageNo} totalPages={totalPages} onNavigate={goToPage} />
    </>
  );
}
