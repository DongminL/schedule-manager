import { and, eq, inArray, or } from "drizzle-orm";

import { db, type Tx } from "@/core/db";
import { pushTokens, users } from "@/core/db/schema";

/**
 * Make `token` the user's only token. Also drops the same token from any other
 * user, so a shared device only notifies whoever logged in last.
 */
export async function replaceUserToken(userId: number, token: string): Promise<void> {
  await db.transaction(async (tx: Tx) => {
    await tx
      .delete(pushTokens)
      .where(or(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
    await tx.insert(pushTokens).values({ userId, token });
  });
}

export async function deleteByToken(token: string): Promise<void> {
  await db.delete(pushTokens).where(eq(pushTokens.token, token));
}

export async function deleteByTokens(tokens: string[]): Promise<void> {
  if (!tokens.length) return;
  await db.delete(pushTokens).where(inArray(pushTokens.token, tokens));
}

/** Tokens of the given users, skipping deactivated (resigned) accounts. */
export async function findTokensByUserIds(userIds: number[]): Promise<string[]> {
  if (!userIds.length) return [];
  const rows = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .innerJoin(users, eq(users.id, pushTokens.userId))
    .where(and(inArray(pushTokens.userId, userIds), eq(users.isActive, true)));
  return rows.map((r) => r.token);
}
