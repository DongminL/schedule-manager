import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="불러오는 중"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Skeleton style={{ width: 96, height: 28 }} />
        <Skeleton style={{ width: 120, height: 20 }} />
        <Skeleton style={{ width: 100, height: 36, marginLeft: "auto" }} />
      </div>
      <Skeleton style={{ height: 40 }} />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} style={{ height: 44 }} />
      ))}
    </div>
  );
}
