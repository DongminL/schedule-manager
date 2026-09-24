import { sendToTokens, type PushPayload } from "../infrastructure/fcmClient";
import * as tokenRepo from "../infrastructure/pushTokenRepository";

export type { PushPayload };

export function registerToken(userId: number, token: string): Promise<void> {
  return tokenRepo.replaceUserToken(userId, token);
}

/** By token value: also used when the session is already gone (logout / 401). */
export function unregisterToken(token: string): Promise<void> {
  return tokenRepo.deleteByToken(token);
}

/**
 * Best-effort push to the given users. Never throws: a notification failure
 * must not fail the change-request operation that triggered it.
 */
export async function notifyUsers(userIds: number[], payload: PushPayload): Promise<void> {
  try {
    const ids = [...new Set(userIds)];
    if (!ids.length) return;

    const tokens = await tokenRepo.findTokensByUserIds(ids);
    if (!tokens.length) return;

    const deadTokens = await sendToTokens(tokens, payload);
    if (deadTokens.length) await tokenRepo.deleteByTokens(deadTokens);
  } catch (e) {
    console.error("[notification] delivery failed", e);
  }
}
