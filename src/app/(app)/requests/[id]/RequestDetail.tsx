"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ChangeType, RequestStatus, Role } from "@/core/db/schema";
import form from "@/components/ui/form.module.scss";
import { ApiError, apiSend } from "@/lib/api";

import { STATUS_KO, TYPE_KO } from "../labels";
import styles from "../requests.module.scss";

export interface RequestDetailData {
  id: number;
  type: ChangeType;
  status: RequestStatus;
  version: number;
  requesterName: string;
  approverName: string | null;
  updateDate: string;
  startHhmm: string;
  endHhmm: string;
  reason: string;
  rejectReason: string | null;
  peerAccepted: boolean;
  substitute: { userName: string; isViewerPeer: boolean } | null;
  timeAdjust: { startHhmm: string; endHhmm: string } | null;
  swap: {
    peerName: string;
    swapDate: string;
    startHhmm: string;
    endHhmm: string;
    isViewerPeer: boolean;
  } | null;
}

export function RequestDetail({
  data,
  viewerRole,
}: {
  data: RequestDetailData;
  viewerRole: Role;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const base = `/api/schedule-changes/${data.id}`;
  const canManage = viewerRole === "MANAGER" && data.status === "PENDING";
  const isViewerPeer = data.swap?.isViewerPeer || data.substitute?.isViewerPeer || false;
  const canPeer = isViewerPeer && data.status === "WAITING_PEER_ACCEPT";
  const peerActionLabel = data.type === "SHIFT" ? "대타" : "교환";

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.status === 409) router.refresh();
      } else {
        setError("처리에 실패했습니다.");
      }
      setBusy(false);
    }
  }

  const approve = () => act(() => apiSend("POST", `${base}/approve`, { version: data.version }));
  const reject = () => {
    if (!rejectReason.trim()) {
      setError("거절 사유를 입력하세요.");
      return;
    }
    return act(() =>
      apiSend("POST", `${base}/reject`, { rejectReason, version: data.version }),
    );
  };
  const peerAccept = () => act(() => apiSend("POST", `${base}/peer-accept`));
  const peerReject = () => {
    const reason = prompt(`${peerActionLabel}을(를) 거절하는 사유를 입력하세요`);
    if (!reason?.trim()) return;
    return act(() => apiSend("POST", `${base}/peer-reject`, { reason }));
  };

  return (
    <section className={styles.detailWrap}>
      <Link href="/requests" className={styles.back}>
        ← 변경요청 목록
      </Link>

      <div className={styles.detailCard}>
        <div className={styles.cardTop}>
          <span className={styles.typeBadge} data-type={data.type}>
            {TYPE_KO[data.type]}
          </span>
          <span className={styles.statusBadge} data-status={data.status}>
            {STATUS_KO[data.status]}
          </span>
        </div>

        <dl className={styles.dl}>
          <dt>신청자</dt>
          <dd>{data.requesterName}</dd>
          <dt>대상 근무</dt>
          <dd>
            {data.updateDate} · {data.startHhmm}–{data.endHhmm}
          </dd>

          {data.type === "TIME_ADJUST" && data.timeAdjust && (
            <>
              <dt>변경 요청 시간</dt>
              <dd>
                {data.timeAdjust.startHhmm}–{data.timeAdjust.endHhmm}
              </dd>
            </>
          )}
          {data.type === "SHIFT" && data.substitute && (
            <>
              <dt>대타 근무자</dt>
              <dd>{data.substitute.userName}</dd>
              <dt>대타 수락</dt>
              <dd>{data.peerAccepted ? "수락됨" : "대기 중"}</dd>
            </>
          )}
          {data.type === "SWAP" && data.swap && (
            <>
              <dt>교환 상대</dt>
              <dd>
                {data.swap.peerName} · {data.swap.swapDate} · {data.swap.startHhmm}–
                {data.swap.endHhmm}
              </dd>
              <dt>상대 수락</dt>
              <dd>{data.peerAccepted ? "수락됨" : "대기 중"}</dd>
            </>
          )}

          <dt>사유</dt>
          <dd>{data.reason}</dd>
          {data.rejectReason && (
            <>
              <dt>거절 사유</dt>
              <dd>{data.rejectReason}</dd>
            </>
          )}
          {data.approverName && (
            <>
              <dt>처리자</dt>
              <dd>{data.approverName}</dd>
            </>
          )}
        </dl>

        {error && <p className={form.error}>{error}</p>}

        {canPeer && (
          <div className={form.actions}>
            <button
              type="button"
              className={form.secondary}
              onClick={peerReject}
              disabled={busy}
            >
              {peerActionLabel} 거절
            </button>
            <button type="button" className={form.submit} onClick={peerAccept} disabled={busy}>
              {peerActionLabel} 수락
            </button>
          </div>
        )}

        {canManage && !showReject && (
          <div className={form.actions}>
            <button
              type="button"
              className={form.secondary}
              onClick={() => setShowReject(true)}
              disabled={busy}
            >
              거절
            </button>
            <button type="button" className={form.submit} onClick={approve} disabled={busy}>
              승인
            </button>
          </div>
        )}

        {canManage && showReject && (
          <div className={form.form}>
            <label className={form.field}>
              <span>거절 사유 (필수)</span>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                maxLength={500}
              />
            </label>
            <div className={form.actions}>
              <button
                type="button"
                className={form.secondary}
                onClick={() => setShowReject(false)}
                disabled={busy}
              >
                취소
              </button>
              <button type="button" className={form.danger} onClick={reject} disabled={busy}>
                거절 확정
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
