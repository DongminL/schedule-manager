import { Skeleton } from "@/components/ui/Skeleton";

/** Fallback shown in place of the shift grid while `getCalendar` streams in. */
export function CalendarGridSkeleton({ view }: { view: "month" | "day" }) {
  if (view === "day") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 48 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
      {Array.from({ length: 35 }).map((_, i) => (
        <Skeleton key={i} style={{ height: 88 }} />
      ))}
    </div>
  );
}
