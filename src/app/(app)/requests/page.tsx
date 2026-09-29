import { REQUEST_STATUS, type RequestStatus } from "@/core/db/schema";
import { listActiveRoster } from "@/modules/account/application/accountService";
import { requirePageSession } from "@/modules/auth/presentation/guards";
import {
  listChangeRequestsPage,
  REQUEST_PAGE_SIZE,
} from "@/modules/change-request/application/changeRequestService";

import { kstClock } from "@/lib/calendar";
import { parsePageNo } from "@/lib/pagination";

import { RequestList } from "./RequestList";

export const dynamic = "force-dynamic";
export const metadata = { title: "변경 요청 · 알바 근무 일정 관리" };

type SearchParams = Promise<{ status?: string; pageNo?: string }>;

export default async function RequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requirePageSession();

  const params = await searchParams;
  const status = REQUEST_STATUS.includes(params.status as RequestStatus)
    ? (params.status as RequestStatus)
    : undefined;
  const pageNo = parsePageNo(params.pageNo);

  const roster = await listActiveRoster();
  const nameById = new Map(roster.map((r) => [r.id, r.name]));

  const rowsPromise = listChangeRequestsPage(viewer, status, pageNo).then((p) => ({
    rows: p.rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      updateDate: r.updateDate,
      startHhmm: kstClock(r.startAt.toISOString()).label,
      endHhmm: kstClock(r.endAt.toISOString()).label,
      requesterName: nameById.get(r.userId) ?? `#${r.userId}`,
      reason: r.reason,
      createdAt: r.createdAt.toISOString().slice(0, 10),
    })),
    totalPages: Math.max(1, Math.ceil(p.total / REQUEST_PAGE_SIZE)),
  }));

  return (
    <RequestList
      rowsPromise={rowsPromise}
      activeStatus={status ?? null}
      pageNo={pageNo}
      isManager={viewer.role === "MANAGER"}
      viewerId={viewer.id}
      roster={roster}
    />
  );
}
