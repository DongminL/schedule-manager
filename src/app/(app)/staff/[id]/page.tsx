import { notFound, redirect } from "next/navigation";

import { getStaff } from "@/modules/account/application/accountService";
import { auth } from "@/modules/auth";
import { listDefaultSchedules } from "@/modules/scheduling/application/schedulingService";

import { kstClock } from "@/lib/calendar";

import { StaffDetail, type PatternRow } from "./StaffDetail";

export const dynamic = "force-dynamic";

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session!.user.role !== "MANAGER") redirect("/");

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const staff = await getStaff(id).catch(() => null);
  if (!staff) notFound();

  const patterns: PatternRow[] = (await listDefaultSchedules(id)).map((p) => ({
    id: p.id,
    dayOfWeek: p.dayOfWeek,
    startHhmm: kstClock(p.startTime.toISOString()).label,
    endHhmm: kstClock(p.endTime.toISOString()).label,
    startDate: p.startDate,
    endDate: p.endDate,
  }));

  return (
    <StaffDetail
      staff={{
        id: staff.id,
        name: staff.name,
        phoneNumber: staff.phoneNumber,
        color: staff.color,
        role: staff.role,
        isActive: staff.isActive,
      }}
      patterns={patterns}
    />
  );
}
