import { listActiveRoster } from "@/modules/account/application/accountService";
import { auth } from "@/modules/auth";
import { getCalendar } from "@/modules/scheduling/application/calendarService";

import { CalendarView, type CalShift, type StaffLite } from "@/components/CalendarView/CalendarView";
import { monthGridDays } from "@/lib/calendar";

export const dynamic = "force-dynamic";

function kstToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

type SearchParams = Promise<{ view?: string; date?: string; userId?: string }>;

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const session = await auth();
  const user = session!.user;
  const viewerId = Number(user.id);
  const isManager = user.role === "MANAGER";

  const view = sp.view === "day" ? "day" : "month";
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : kstToday();

  const days = view === "day" ? [anchor] : monthGridDays(anchor);
  const from = days[0]!;
  const to = days[days.length - 1]!;

  const filterUserId = sp.userId && /^\d+$/.test(sp.userId) ? Number(sp.userId) : undefined;

  const [{ shifts }, roster] = await Promise.all([
    getCalendar({ from, to, userId: filterUserId, viewerRole: user.role, viewerId }),
    listActiveRoster(),
  ]);

  const staff: StaffLite[] = roster.map((s) => ({ id: s.id, name: s.name, color: s.color }));

  return (
    <CalendarView
      view={view}
      anchor={anchor}
      today={kstToday()}
      shifts={shifts as CalShift[]}
      staff={staff}
      isManager={isManager}
      viewerId={viewerId}
      selectedUserId={filterUserId ?? null}
    />
  );
}
