import type { ChangeType, RequestStatus } from "@/core/db/schema";

/** Korean labels for a change-request's type / status, shared by the list and
 *  detail views. */
export const TYPE_KO: Record<ChangeType, string> = {
  SHIFT: "대타",
  SWAP: "교환",
  TIME_ADJUST: "시간 변경",
};

export const STATUS_KO: Record<RequestStatus, string> = {
  PENDING: "대기",
  WAITING_PEER_ACCEPT: "상대 수락 대기",
  APPROVAL: "승인",
  REJECT: "거절",
};
