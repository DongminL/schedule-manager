"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import type { Role } from "@/core/db/schema";
import { roleLabel } from "@/lib/roleLabel";

import { StaffFormDialog } from "./StaffFormDialog";
import styles from "./staff.module.scss";

export interface StaffRow {
  id: number;
  name: string;
  phoneNumber: string;
  color: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
}

export function StaffTable({
  rows,
  showInactive,
}: {
  rows: StaffRow[];
  showInactive: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [creating, setCreating] = useState(false);

  function toggleInactive() {
    const q = new URLSearchParams(params.toString());
    if (showInactive) q.delete("inactive");
    else q.set("inactive", "1");
    router.push(`${pathname}?${q.toString()}`);
  }

  return (
    <section className={styles.wrap}>
      <div className={styles.toolbar}>
        <h2 className={styles.title}>직원 관리</h2>
        <label className={styles.checkbox}>
          <input type="checkbox" checked={showInactive} onChange={toggleInactive} />
          비활성 포함
        </label>
        <button type="button" className={styles.add} onClick={() => setCreating(true)}>
          <Plus size={16} /> 직원 추가
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>이름</th>
              <th>연락처</th>
              <th>역할</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  직원이 없습니다.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
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
                    <span className={styles.badgeOk}>
                      {r.mustChangePassword ? "비번 변경 대기" : "활성"}
                    </span>
                  ) : (
                    <span className={styles.badgeOff}>비활성</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StaffFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          router.refresh();
        }}
      />
    </section>
  );
}
