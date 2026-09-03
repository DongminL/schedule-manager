import { notFound } from "next/navigation";

import { listActiveRoster } from "@/modules/account/application/accountService";
import { auth } from "@/modules/auth";
import { getChangeRequestDetail } from "@/modules/change-request/application/changeRequestService";

import { kstClock } from "@/lib/calendar";

import { RequestDetail, type RequestDetailData } from "./RequestDetail";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const viewer = {
    id: Number(session!.user.id),
    role: session!.user.role,
    name: session!.user.name ?? "",
    mustChangePassword: session!.user.mustChangePassword,
  };

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const detail = await getChangeRequestDetail(id, viewer).catch(() => null);
  if (!detail) notFound();

  const roster = await listActiveRoster();
  const nameOf = (uid: number | null | undefined) =>
    uid == null ? null : (roster.find((r) => r.id === uid)?.name ?? `#${uid}`);
  const hhmm = (d: Date) => kstClock(d.toISOString()).label;

  const data: RequestDetailData = {
    id: detail.id,
    type: detail.type,
    status: detail.status,
    version: detail.version,
    requesterName: nameOf(detail.userId) ?? `#${detail.userId}`,
    approverName: nameOf(detail.approveBy),
    updateDate: detail.updateDate,
    startHhmm: hhmm(detail.startAt),
    endHhmm: hhmm(detail.endAt),
    reason: detail.reason,
    rejectReason: detail.rejectReason,
    peerAccepted: detail.peerAcceptedAt != null,
    substitute: detail.substitute
      ? {
          userName: nameOf(detail.substitute.userId) ?? `#${detail.substitute.userId}`,
          isViewerPeer: detail.substitute.userId === viewer.id,
        }
      : null,
    timeAdjust: detail.timeAdjust
      ? {
          startHhmm: hhmm(detail.timeAdjust.adjustStartAt),
          endHhmm: hhmm(detail.timeAdjust.adjustEndAt),
        }
      : null,
    swap: detail.swap
      ? {
          peerName: nameOf(detail.swap.peerUserId) ?? `#${detail.swap.peerUserId}`,
          swapDate: detail.swap.swapDate,
          startHhmm: hhmm(detail.swap.startAt),
          endHhmm: hhmm(detail.swap.endAt),
          isViewerPeer: detail.swap.peerUserId === viewer.id,
        }
      : null,
  };

  return <RequestDetail data={data} viewerRole={viewer.role} />;
}
