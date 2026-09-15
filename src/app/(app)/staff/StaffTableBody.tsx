"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

import { roleLabel } from "@/lib/roleLabel";

import type { StaffRow } from "./StaffTable";
import styles from "./staff.module.scss";

/** Unwraps the streamed staff rows so the toolbar can render before they arrive. */
export function StaffTableBody({ rowsPromise }: { rowsPromise: Promise<StaffRow[]> }) {
  const rows = use(rowsPromise);
  const router = useRouter();

  /** 
   * Row-wide click convenience for mouse/touch; 
   * the Link in the name cell already covers keyboard/screen readers. 
   */
  function handleRowClick(e: React.MouseEvent<HTMLTableRowElement>, id: number) {
    if (e.target instanceof HTMLElement && e.target.closest("a")) return;
    router.push(`/staff/${id}`);
  }

  return (
    <tbody>
      {rows.length === 0 && (
        <tr>
          <td colSpan={4} className={styles.empty}>
            직원이 없습니다.
          </td>
        </tr>
      )}
      {rows.map((r) => (
        <tr key={r.id} onClick={(e) => handleRowClick(e, r.id)}>
          <td>
            <Link href={`/staff/${r.id}`} className={styles.nameLink}>
              <i className={styles.dot} style={{ background: r.color }} />
              {r.name}
            </Link>
          </td>
          <td className={styles.mono}>{r.phoneNumber}</td>
          <td>{roleLabel(r.role)}</td>
          <td>
            {r.isActive ? (
              <span className={styles.badgeOk} title={r.mustChangePassword ? "비번 변경 대기" : undefined}>
                {r.mustChangePassword ? "임시" : "활성"}
              </span>
            ) : (
              <span className={styles.badgeOff}>비활성</span>
            )}
          </td>
        </tr>
      ))}
    </tbody>
  );
}
