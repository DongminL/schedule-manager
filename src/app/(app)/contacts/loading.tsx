import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="불러오는 중"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <Skeleton style={{ height: 28, width: 100 }} />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} style={{ height: 64 }} />
      ))}
    </div>
  );
}
