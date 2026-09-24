import type { ScheduleChangeRequestRow } from "@/core/db/schema";
import {
  findById as findUserById,
  listActiveManagerIds,
} from "@/modules/account/infrastructure/userRepository";
import { notifyUsers } from "@/modules/notification/application/notificationService";

import * as repo from "../infrastructure/changeRequestRepository";

export type RequestEvent =
  | "CREATED"
  | "PEER_ACCEPTED"
  | "PEER_REJECTED"
  | "MANAGER_REJECTED"
  | "APPROVED";

const TITLE = "변경 요청";

/** The user whose acceptance the request needs: swap peer or assigned substitute. */
async function findPeerUserId(request: ScheduleChangeRequestRow): Promise<number | undefined> {
  if (request.type === "SWAP") return (await repo.findSwapByParent(request.id))?.peerUserId;
  if (request.type === "SHIFT") return (await repo.findSubstituteByParent(request.id))?.userId;
  return undefined;
}

async function nameOf(userId: number): Promise<string> {
  return (await findUserById(userId))?.name ?? "";
}

async function managersExcept(userId: number): Promise<number[]> {
  return (await listActiveManagerIds()).filter((id) => id !== userId);
}

async function plan(
  event: RequestEvent,
  request: ScheduleChangeRequestRow,
): Promise<{ recipients: number[]; body: string }> {
  switch (event) {
    case "CREATED":
    case "PEER_ACCEPTED": {
      const body = `${await nameOf(request.userId)}님이 변경 요청을 보냈습니다.`;
      // Managers only hear about it once it is PENDING; before that the peer decides.
      if (request.status === "PENDING") {
        return { recipients: await managersExcept(request.userId), body };
      }
      const peerId = await findPeerUserId(request);
      return { recipients: peerId === undefined ? [] : [peerId], body };
    }
    case "PEER_REJECTED": {
      const peerId = await findPeerUserId(request);
      const peerName = peerId === undefined ? "" : await nameOf(peerId);
      return { recipients: [request.userId], body: `${peerName}님이 변경 요청을 거절했습니다.` };
    }
    case "MANAGER_REJECTED":
      return { recipients: [request.userId], body: "변경 요청이 거절되었습니다." };
    case "APPROVED": {
      const peerId = await findPeerUserId(request);
      return {
        recipients: peerId === undefined ? [request.userId] : [request.userId, peerId],
        body: "변경 요청이 승인되었습니다.",
      };
    }
  }
}

/**
 * Push the notification for a request lifecycle event. Call it after the
 * transaction has committed; it never throws.
 */
export async function notifyRequestEvent(
  event: RequestEvent,
  request: ScheduleChangeRequestRow,
): Promise<void> {
  try {
    const { recipients, body } = await plan(event, request);
    if (!recipients.length) return;
    await notifyUsers(recipients, { title: TITLE, body, url: `/requests/${request.id}` });
  } catch (e) {
    console.error("[change-request] notification failed", e);
  }
}
