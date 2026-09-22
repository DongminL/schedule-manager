import { and, asc, desc, eq, ne } from "drizzle-orm";

import { db, type Exec } from "@/core/db";
import { users, type NewUserRow, type UserRow } from "@/core/db/schema";

export function findById(id: number, exec: Exec = db): Promise<UserRow | undefined> {
  return exec
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
    .then((r) => r[0]);
}

export function findByPhoneNumber(phoneNumber: string): Promise<UserRow | undefined> {
  return db
    .select()
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber))
    .limit(1)
    .then((r) => r[0]);
}

export function list(includeInactive: boolean): Promise<UserRow[]> {
  return db
    .select()
    .from(users)
    .where(includeInactive ? undefined : eq(users.isActive, true))
    .orderBy(asc(users.name));
}

/**
 * Staff management screen: active roster (name asc) and resigned roster
 * (most recently updated first — resigning is the update that flips
 * isActive, so updatedAt doubles as the resignation date).
 */
export async function listGrouped(): Promise<{ active: UserRow[]; resigned: UserRow[] }> {
  const [active, resigned] = await Promise.all([
    db.select().from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)),
    db.select().from(users).where(eq(users.isActive, false)).orderBy(desc(users.updatedAt)),
  ]);
  return { active, resigned };
}

export async function phoneNumberTakenByOther(
  phoneNumber: string,
  exceptId: number,
): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.phoneNumber, phoneNumber), ne(users.id, exceptId)))
    .limit(1);
  return rows.length > 0;
}

export async function insert(values: NewUserRow): Promise<UserRow> {
  const [row] = await db.insert(users).values(values).returning();
  return row!;
}

export async function update(
  id: number,
  patch: Partial<NewUserRow>,
): Promise<UserRow | undefined> {
  const [row] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return row;
}
