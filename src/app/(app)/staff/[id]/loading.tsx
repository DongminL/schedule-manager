import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="불러오는 중"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Skeleton style={{ width: 48, height: 48, borderRadius: "50%" }} />
        <Skeleton style={{ width: 140, height: 24 }} />
      </div>
      <Skeleton style={{ height: 20, width: 200 }} />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} style={{ height: 40 }} />
      ))}
    </div>
  );
}
