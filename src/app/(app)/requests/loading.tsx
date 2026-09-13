import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="불러오는 중"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Skeleton style={{ width: 100, height: 28 }} />
        <Skeleton style={{ width: 160, height: 18 }} />
        <Skeleton style={{ width: 110, height: 36, marginLeft: "auto" }} />
      </div>
      <Skeleton style={{ height: 36, width: 320 }} />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} style={{ height: 96 }} />
      ))}
    </div>
  );
}
