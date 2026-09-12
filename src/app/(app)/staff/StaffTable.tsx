"use client";

import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import type { Role } from "@/core/db/schema";

import { StaffFormDialog } from "./StaffFormDialog";
import { StaffTableBody } from "./StaffTableBody";
import { StaffTableSkeleton } from "./StaffTableSkeleton";
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
  rowsPromise,
  showInactive,
}: {
  rowsPromise: Promise<StaffRow[]>;
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
          <Suspense fallback={<StaffTableSkeleton />}>
            <StaffTableBody rowsPromise={rowsPromise} />
          </Suspense>
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
