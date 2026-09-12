import { Skeleton } from "@/components/ui/Skeleton";

/** Fallback shown in place of the request cards while `listChangeRequests` streams in. */
export function RequestListSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} style={{ height: 96 }} />
      ))}
    </div>
  );
}
