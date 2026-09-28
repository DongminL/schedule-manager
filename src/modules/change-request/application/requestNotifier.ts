import { after } from "next/server";

import type { ScheduleChangeRequestRow } from "@/core/db/schema";
import {
  findById as findUserById,
  listActiveManagerIds,
} from "@/modules/account/infrastructure/userRepository";
import { notifyUsers } from "@/modules/notification/application/notificationService";

import { findPeerUserOf } from "./changeRequestService";

export type RequestEvent =
  | "CREATED"
  | "PEER_ACCEPTED"
  | "PEER_REJECTED"
  | "MANAGER_REJECTED"
  | "APPROVED";

const TITLE = "변경 요청";

async function nameOf(userId: number): Promise<string> {
  return (await findUserById(userId))?.name ?? "";
}

async function managersExcept(userId: number): Promise<number[]> {
  return (await listActiveManagerIds()).filter((id) => id !== userId);
}

async function peerUserIdsOf(request: ScheduleChangeRequestRow): Promise<number[]> {
  const peerUserId = await findPeerUserOf(request);
  return peerUserId === undefined ? [] : [peerUserId];
}

async function plan(
  event: RequestEvent,
  request: ScheduleChangeRequestRow,
): Promise<{ recipients: number[]; body: string }> {
  switch (event) {
    case "CREATED":
    case "PEER_ACCEPTED": {
      // Managers only hear about it once it is PENDING; before that the peer decides.
      const [name, recipients] = await Promise.all([
        nameOf(request.userId),
        request.status === "PENDING" ? managersExcept(request.userId) : peerUserIdsOf(request),
      ]);
      return { recipients, body: `${name}님이 변경 요청을 보냈습니다.` };
    }
    case "PEER_REJECTED": {
      const peerUserId = await findPeerUserOf(request);
      const peerName = peerUserId === undefined ? "" : await nameOf(peerUserId);
      return { recipients: [request.userId], body: `${peerName}님이 변경 요청을 거절했습니다.` };
    }
    case "MANAGER_REJECTED":
      return { recipients: [request.userId], body: "변경 요청이 거절되었습니다." };
    case "APPROVED":
      return {
        recipients: [request.userId, ...(await peerUserIdsOf(request))],
        body: "변경 요청이 승인되었습니다.",
      };
  }
}

async function deliver(event: RequestEvent, request: ScheduleChangeRequestRow): Promise<void> {
  try {
    const { recipients, body } = await plan(event, request);
    if (!recipients.length) return;
    await notifyUsers(recipients, { title: TITLE, body, url: `/requests/${request.id}` });
  } catch (e) {
    console.error("[change-request] notification failed", e);
  }
}

/**
 * Push the notification for a request lifecycle event after the response has
 * been sent. Call it once the transaction has committed; it never throws.
 */
export function notifyRequestEvent(event: RequestEvent, request: ScheduleChangeRequestRow): void {
  after(() => deliver(event, request));
}
