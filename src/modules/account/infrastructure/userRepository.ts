import { and, asc, eq, ne } from "drizzle-orm";

import { db } from "@/core/db";
import { users, type NewUserRow, type UserRow } from "@/core/db/schema";

export function findById(id: number): Promise<UserRow | undefined> {
  return db
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
