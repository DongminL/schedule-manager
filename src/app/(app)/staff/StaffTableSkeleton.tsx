import { Skeleton } from "@/components/ui/Skeleton";

/** Fallback rows shown while `listStaff` streams in. */
export function StaffTableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          <td colSpan={4}>
            <Skeleton style={{ height: 20 }} />
          </td>
        </tr>
      ))}
    </tbody>
  );
}
