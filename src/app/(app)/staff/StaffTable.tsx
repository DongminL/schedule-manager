"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";

import type { Role } from "@/core/db/schema";
import { useSlidingIndicator } from "@/lib/useSlidingIndicator";

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
  updatedAt: string;
}

export interface StaffGroups {
  active: StaffRow[];
  resigned: StaffRow[];
}

export type StaffTab = "active" | "resigned";

const TABS: { label: string; value: StaffTab }[] = [
  { label: "재직자", value: "active" },
  { label: "퇴사자", value: "resigned" },
];

export function StaffTable({ rowsPromise }: { rowsPromise: Promise<StaffGroups> }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<StaffTab>("active");

  const activeIndex = TABS.findIndex((t) => t.value === tab);
  const tabSeg = useSlidingIndicator(activeIndex);

  return (
    <section className={styles.wrap}>
      <div className={styles.toolbar}>
        <h2 className={styles.title}>직원 관리</h2>
        <button type="button" className={styles.add} onClick={() => setCreating(true)}>
          <Plus size={16} /> 직원 추가
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
            key={t.value}
            type="button"
            role="tab"
            ref={tabSeg.setItemRef(i)}
            aria-selected={tab === t.value}
            className={tab === t.value ? styles.tabActive : styles.tab}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Suspense fallback={<StaffTableSkeleton />}>
        <StaffTableBody rowsPromise={rowsPromise} tab={tab} />
      </Suspense>

      {creating && (
        <StaffFormDialog
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
