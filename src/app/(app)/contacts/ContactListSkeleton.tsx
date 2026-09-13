import { Skeleton } from "@/components/ui/Skeleton";

/** Fallback shown in place of the contact cards while `listContactDirectory` streams in. */
export function ContactListSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} style={{ height: 64 }} />
      ))}
    </div>
  );
}
