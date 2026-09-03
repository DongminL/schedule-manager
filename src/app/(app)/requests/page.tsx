import { REQUEST_STATUS, type RequestStatus } from "@/core/db/schema";
import { listActiveRoster } from "@/modules/account/application/accountService";
import { auth } from "@/modules/auth";
import { listChangeRequests } from "@/modules/change-request/application/changeRequestService";

import { kstClock } from "@/lib/calendar";

import { RequestList, type RequestRow } from "./RequestList";

export const dynamic = "force-dynamic";
export const metadata = { title: "변경요청 · 알바 근무 일정 관리" };

type SearchParams = Promise<{ status?: string }>;

export default async function RequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  const viewer = {
    id: Number(session!.user.id),
    role: session!.user.role,
    name: session!.user.name ?? "",
    mustChangePassword: session!.user.mustChangePassword,
  };

  const raw = (await searchParams).status;
  const status = REQUEST_STATUS.includes(raw as RequestStatus)
    ? (raw as RequestStatus)
    : undefined;

  const [rows, roster] = await Promise.all([listChangeRequests(viewer, status), listActiveRoster()]);
  const nameById = new Map(roster.map((r) => [r.id, r.name]));
  const rosterLite = roster.map((r) => ({ id: r.id, name: r.name, color: r.color }));

  const list: RequestRow[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    updateDate: r.updateDate,
    startHhmm: kstClock(r.startAt.toISOString()).label,
    endHhmm: kstClock(r.endAt.toISOString()).label,
    requesterName: nameById.get(r.userId) ?? `#${r.userId}`,
    reason: r.reason,
    createdAt: r.createdAt.toISOString().slice(0, 10),
  }));

  return (
    <RequestList
      rows={list}
      activeStatus={status ?? null}
      isManager={viewer.role === "MANAGER"}
      viewerId={viewer.id}
      roster={rosterLite}
    />
  );
}
