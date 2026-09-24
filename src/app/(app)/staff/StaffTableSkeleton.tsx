import { Skeleton } from "@/components/ui/Skeleton";

import styles from "./staff.module.scss";

/** Fallback shown while `listStaff` streams in. */
export function StaffTableSkeleton() {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <tbody>
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i}>
              <td colSpan={4}>
                <Skeleton style={{ height: 20 }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
