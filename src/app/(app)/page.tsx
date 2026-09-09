import { listActiveRoster, listFullRoster } from "@/modules/account/application/accountService";
import { requirePageSession } from "@/modules/auth/presentation/guards";
import { getCalendar } from "@/modules/scheduling/application/calendarService";

import { CalendarView, type CalShift } from "@/components/CalendarView/CalendarView";
import { kstToday, monthGridDays } from "@/lib/calendar";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ view?: string; date?: string; userId?: string }>;

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const user = await requirePageSession();
  const viewerId = user.id;
  const isManager = user.role === "MANAGER";

  const view = sp.view === "day" ? "day" : "month";
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : kstToday();

  const days = view === "day" ? [anchor] : monthGridDays(anchor);
  const from = days[0]!;
  const to = days[days.length - 1]!;

  const filterUserId = sp.userId && /^\d+$/.test(sp.userId) ? Number(sp.userId) : undefined;

  const [{ shifts }, roster, allStaff] = await Promise.all([
    getCalendar({ from, to, userId: filterUserId, viewerRole: user.role, viewerId }),
    listActiveRoster(),
    listFullRoster(),
  ]);

  return (
    <CalendarView
      view={view}
      anchor={anchor}
      today={kstToday()}
      shifts={shifts as CalShift[]}
      staff={roster}
      allStaff={allStaff}
      isManager={isManager}
      viewerId={viewerId}
      selectedUserId={filterUserId ?? null}
    />
  );
}
